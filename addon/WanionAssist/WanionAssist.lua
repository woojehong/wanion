-- 와니온 어시스트 (WanionAssist) — WANION 인게임 브릿지
-- 웹에서 복사한 코드(WANION1;...)를 창에 붙여넣고 버튼으로 초대/파티배치.
-- [스냅샷 생성] 버튼은 현재 공대 명단을 코드로 뽑아 웹에 붙여넣게 함.
-- 슬래시 명령이 아니라 "버튼 클릭" 중심 UI (대표님 요구).
--
-- ⚠ 인게임 미검증 — 실제 클라이언트에서 동작 확인 후 오류 메시지 주시면 맞춰 수정합니다.

local ADDON = ...
local VERSION = "WANION1"
local SNAP_VERSION = "WANIONSNAP1"
local CODE_ROLE = { T = "tank", H = "heal", D = "dps", G = "guest" }
local ROLE_KO = { tank = "탱", heal = "힐", dps = "딜", guest = "손님" }

WanionAssistDB = WanionAssistDB or {}

-- ─────────────────────────────────────────────────────────────
-- 체크섬 (웹 src/lib/bridge.js checksum과 동일: UTF-8 바이트, base36 4자리)
-- ─────────────────────────────────────────────────────────────
local B36 = "0123456789abcdefghijklmnopqrstuvwxyz"
local function toBase36(n)
  if n == 0 then return "0" end
  local s = ""
  while n > 0 do
    local r = n % 36
    s = B36:sub(r + 1, r + 1) .. s
    n = math.floor(n / 36)
  end
  return s
end
local function checksum(payload)
  local sum = 0
  for i = 1, #payload do
    sum = (sum * 31 + payload:byte(i)) % 1679615
  end
  local s = toBase36(sum)
  return ("0"):rep(math.max(0, 4 - #s)) .. s
end

-- ─────────────────────────────────────────────────────────────
-- 파싱
-- ─────────────────────────────────────────────────────────────
local function splitSemis(payload)
  local parts, start = {}, 1
  while true do
    local idx = payload:find(";", start, true)
    if idx then
      table.insert(parts, payload:sub(start, idx - 1))
      start = idx + 1
    else
      table.insert(parts, payload:sub(start))
      break
    end
  end
  return parts
end

-- 코드 → { mode, raidId, list } 또는 nil, 오류메시지
local function parseCode(raw)
  raw = strtrim(raw or "")
  if raw == "" then return nil, "코드를 붙여넣어주세요." end
  local lastSep
  for i = #raw, 1, -1 do
    if raw:sub(i, i) == ";" then lastSep = i break end
  end
  if not lastSep then return nil, "코드 형식이 아니에요." end
  local payload = raw:sub(1, lastSep - 1)
  local chk = raw:sub(lastSep + 1)
  if checksum(payload) ~= chk then
    return nil, "코드가 손상됐어요. 웹에서 다시 복사해주세요."
  end
  local p = splitSemis(payload)
  if p[1] ~= VERSION then return nil, "와니온 코드가 아니에요." end
  return { mode = p[2], raidId = p[3], list = p[4] or "" }
end

local function parseInviteList(list)
  local out = {}
  for tok in list:gmatch("([^,]+)") do
    local nameServer, roleSeg, party = strsplit(":", tok)
    local main = roleSeg or "D"
    local plus = main:find("+", 1, true)
    if plus then main = main:sub(1, plus - 1) end
    table.insert(out, {
      nameServer = nameServer,
      role = CODE_ROLE[main] or "dps",
      party = tonumber(party),
    })
  end
  return out
end

local function parseSortList(list)
  local out = {}
  for tok in list:gmatch("([^,]+)") do
    local nameServer, party = strsplit(":", tok)
    table.insert(out, { nameServer = nameServer, party = tonumber(party) })
  end
  return out
end

-- ─────────────────────────────────────────────────────────────
-- 이름 정규화 (매칭용) — "이름-서버" ↔ 인게임 이름
-- ─────────────────────────────────────────────────────────────
local function nameOnly(ns) return (ns:gsub("%-.*$", "")) end
local function normalize(s) return (s or ""):gsub("%s", ""):lower() end

local function playerRealm() return (GetRealmName() or ""):gsub("%s", "") end

-- 인게임 이름을 "이름-서버" 형태로 (동일서버는 서버 붙임)
local function withRealm(nm)
  if not nm then return nil end
  if nm:find("-", 1, true) then return (nm:gsub("%s", "")) end
  return nm .. "-" .. playerRealm()
end

-- ─────────────────────────────────────────────────────────────
-- 현재 그룹 멤버 집합 / 이름→raid index
-- ─────────────────────────────────────────────────────────────
local function currentMemberSet()
  local set = {}
  if IsInRaid() then
    for i = 1, GetNumGroupMembers() do
      local nm = GetRaidRosterInfo(i)
      if nm then
        set[normalize(nm)] = true
        set[normalize(nameOnly(nm))] = true
      end
    end
  elseif IsInGroup() then
    set[normalize(UnitName("player"))] = true
    for i = 1, GetNumSubgroupMembers() do
      local nm = UnitName("party" .. i)
      if nm then set[normalize(nm)] = true end
    end
  end
  return set
end

local function raidIndexByName()
  local map = {}
  for i = 1, GetNumGroupMembers() do
    local nm = GetRaidRosterInfo(i)
    if nm then
      map[normalize(nm)] = i
      map[normalize(nameOnly(nm))] = i
    end
  end
  return map
end

-- ─────────────────────────────────────────────────────────────
-- 액션: 초대 / 파티배치 / 스냅샷
-- ─────────────────────────────────────────────────────────────
local UI  -- forward

local function invite(entries)
  if InCombatLockdown() then return UI.status("전투 중에는 초대할 수 없어요.", true) end
  local inGroup = currentMemberSet()
  local sent, skipped = 0, 0
  local inviteFn = (C_PartyInfo and C_PartyInfo.InviteUnit) or InviteUnit
  for _, e in ipairs(entries) do
    if e.role == "guest" then
      skipped = skipped + 1
    elseif inGroup[normalize(e.nameServer)] or inGroup[normalize(nameOnly(e.nameServer))] then
      skipped = skipped + 1
    else
      local target = e.nameServer -- "이름-서버"
      pcall(inviteFn, target)
      sent = sent + 1
    end
  end
  UI.status(("초대 %d명 요청 · 이미있음/손님 %d명 제외. 수락 대기 중."):format(sent, skipped))
end

local function sortParties(entries)
  if not IsInRaid() then return UI.status("공격대 상태에서만 파티 배치가 돼요.", true) end
  if not (UnitIsGroupLeader("player") or UnitIsGroupAssistant("player")) then
    return UI.status("공대장/부공대장만 파티 배치가 가능해요.", true)
  end
  if InCombatLockdown() then return UI.status("전투 중에는 배치할 수 없어요.", true) end
  local idxMap = raidIndexByName()
  local moved, missing = 0, 0
  for _, e in ipairs(entries) do
    local idx = idxMap[normalize(e.nameServer)] or idxMap[normalize(nameOnly(e.nameServer))]
    if idx and e.party and e.party >= 1 and e.party <= 8 then
      local _, _, subgroup = GetRaidRosterInfo(idx)
      if subgroup ~= e.party then
        pcall(SetRaidSubgroup, idx, e.party)
        moved = moved + 1
      end
    elseif not idx then
      missing = missing + 1
    end
  end
  UI.status(("파티 배치 %d명 처리 · 공대에 없음 %d명. (칸이 차면 일부는 수동 조정)"):format(moved, missing))
end

local function makeSnapshot()
  if not IsInGroup() then return UI.status("파티/공대 상태에서만 스냅샷이 돼요.", true) end
  local names = {}
  if IsInRaid() then
    for i = 1, GetNumGroupMembers() do
      local nm = GetRaidRosterInfo(i)
      if nm then table.insert(names, withRealm(nm)) end
    end
  else
    table.insert(names, withRealm(UnitName("player")))
    for i = 1, GetNumSubgroupMembers() do
      local nm = UnitName("party" .. i)
      if nm then table.insert(names, withRealm(nm)) end
    end
  end
  local raidId = WanionAssistDB.lastRaidId or "snap"
  local payload = SNAP_VERSION .. ";" .. raidId .. ";" .. table.concat(names, ",")
  local code = payload .. ";" .. checksum(payload)
  UI.showCode(code)
  UI.status(("스냅샷 %d명 생성 완료 — 아래 코드를 복사(Ctrl+C)해서 웹에 붙여넣으세요."):format(#names))
end

-- 붙여넣기 실행 (INV/SORT 자동 판별)
local function runPasted(forceMode)
  local raw = UI.getCode()
  local parsed, err = parseCode(raw)
  if not parsed then return UI.status(err, true) end
  WanionAssistDB.lastRaidId = parsed.raidId
  local mode = forceMode or parsed.mode
  if mode == "INV" then
    invite(parseInviteList(parsed.list))
  elseif mode == "SORT" then
    sortParties(parseSortList(parsed.list))
  else
    UI.status("초대(INV)/배치(SORT) 코드가 아니에요.", true)
  end
end

-- ─────────────────────────────────────────────────────────────
-- UI
-- ─────────────────────────────────────────────────────────────
local function buildUI()
  local f = CreateFrame("Frame", "WanionAssistFrame", UIParent, "BackdropTemplate")
  f:SetSize(380, 320)
  f:SetPoint("CENTER")
  f:SetMovable(true)
  f:EnableMouse(true)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", f.StartMoving)
  f:SetScript("OnDragStop", f.StopMovingOrSizing)
  f:SetClampedToScreen(true)
  f:SetBackdrop({
    bgFile = "Interface\\DialogFrame\\UI-DialogBox-Background",
    edgeFile = "Interface\\DialogFrame\\UI-DialogBox-Border",
    tile = true, tileSize = 32, edgeSize = 24,
    insets = { left = 8, right = 8, top = 8, bottom = 8 },
  })
  f:Hide()

  local title = f:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
  title:SetPoint("TOP", 0, -14)
  title:SetText("와니온 어시스트")

  local close = CreateFrame("Button", nil, f, "UIPanelCloseButton")
  close:SetPoint("TOPRIGHT", -6, -6)

  local hint = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  hint:SetPoint("TOPLEFT", 16, -40)
  hint:SetText("웹에서 [인게임 초대 코드] 복사 → 아래에 붙여넣기(Ctrl+V)")

  -- 코드 입력/출력 박스 (멀티라인 + 스크롤)
  local scroll = CreateFrame("ScrollFrame", "WanionAssistScroll", f, "InputScrollFrameTemplate")
  scroll:SetPoint("TOPLEFT", 16, -58)
  scroll:SetPoint("TOPRIGHT", -32, -58)
  scroll:SetHeight(120)
  local edit = scroll.EditBox
  edit:SetMaxLetters(0)
  edit:SetFontObject(ChatFontNormal)
  edit:SetWidth(scroll:GetWidth() - 20)
  if scroll.CharCount then scroll.CharCount:Hide() end
  edit:SetScript("OnEscapePressed", edit.ClearFocus)

  local status = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  status:SetPoint("BOTTOMLEFT", 16, 52)
  status:SetPoint("BOTTOMRIGHT", -16, 52)
  status:SetJustifyH("LEFT")
  status:SetHeight(28)
  status:SetText("|cff8a70ff코드를 붙여넣고 [실행]을 누르세요.|r")

  -- 버튼들
  local function mkBtn(text, w)
    local b = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
    b:SetSize(w or 84, 24)
    b:SetText(text)
    return b
  end

  local bRun = mkBtn("실행 (자동)", 100)
  bRun:SetPoint("BOTTOMLEFT", 16, 16)
  bRun:SetScript("OnClick", function() runPasted(nil) end)

  local bInv = mkBtn("초대만", 78)
  bInv:SetPoint("LEFT", bRun, "RIGHT", 6, 0)
  bInv:SetScript("OnClick", function() runPasted("INV") end)

  local bSort = mkBtn("파티배치만", 90)
  bSort:SetPoint("LEFT", bInv, "RIGHT", 6, 0)
  bSort:SetScript("OnClick", function() runPasted("SORT") end)

  local bSnap = mkBtn("스냅샷 생성", 96)
  bSnap:SetPoint("LEFT", bSort, "RIGHT", 6, 0)
  bSnap:SetScript("OnClick", makeSnapshot)

  UI = {
    frame = f,
    getCode = function() return edit:GetText() end,
    showCode = function(code)
      edit:SetText(code)
      edit:HighlightText()
      edit:SetFocus()
    end,
    status = function(msg, isErr)
      status:SetText((isErr and "|cffff5555" or "|cff9ad3a0") .. msg .. "|r")
    end,
    toggle = function()
      if f:IsShown() then f:Hide() else f:Show() end
    end,
  }
  return f
end

-- ─────────────────────────────────────────────────────────────
-- 미니맵 버튼 (버튼 클릭으로 창 열기 — 명령어 불필요)
-- ─────────────────────────────────────────────────────────────
local function buildMinimapButton()
  local mb = CreateFrame("Button", "WanionAssistMinimapButton", Minimap)
  mb:SetSize(32, 32)
  mb:SetFrameStrata("MEDIUM")
  mb:SetFrameLevel(8)
  mb:RegisterForClicks("LeftButtonUp")
  mb:RegisterForDrag("LeftButton")

  local icon = mb:CreateTexture(nil, "BACKGROUND")
  icon:SetTexture("Interface\\Icons\\INV_Misc_GroupNeedMore")
  icon:SetSize(20, 20)
  icon:SetPoint("CENTER", 0, 1)
  icon:SetTexCoord(0.08, 0.92, 0.08, 0.92)

  local border = mb:CreateTexture(nil, "OVERLAY")
  border:SetTexture("Interface\\Minimap\\MiniMap-TrackingBorder")
  border:SetSize(52, 52)
  border:SetPoint("TOPLEFT")

  WanionAssistDB.mmAngle = WanionAssistDB.mmAngle or 210
  local function reposition()
    local a = math.rad(WanionAssistDB.mmAngle)
    local r = 80
    mb:SetPoint("CENTER", Minimap, "CENTER", r * math.cos(a), r * math.sin(a))
  end
  reposition()

  mb:SetScript("OnDragStart", function(self)
    self:SetScript("OnUpdate", function()
      local mx, my = Minimap:GetCenter()
      local cx, cy = GetCursorPosition()
      local scale = Minimap:GetEffectiveScale()
      cx, cy = cx / scale, cy / scale
      WanionAssistDB.mmAngle = math.deg(math.atan2(cy - my, cx - mx))
      reposition()
    end)
  end)
  mb:SetScript("OnDragStop", function(self) self:SetScript("OnUpdate", nil) end)

  mb:SetScript("OnClick", function() UI.toggle() end)
  mb:SetScript("OnEnter", function(self)
    GameTooltip:SetOwner(self, "ANCHOR_LEFT")
    GameTooltip:AddLine("와니온 어시스트")
    GameTooltip:AddLine("클릭: 창 열기/닫기", 0.7, 0.7, 0.7)
    GameTooltip:Show()
  end)
  mb:SetScript("OnLeave", function() GameTooltip:Hide() end)
end

-- ─────────────────────────────────────────────────────────────
-- 로드
-- ─────────────────────────────────────────────────────────────
local loader = CreateFrame("Frame")
loader:RegisterEvent("PLAYER_LOGIN")
loader:SetScript("OnEvent", function()
  buildUI()
  buildMinimapButton()
  -- 창 여는 용도의 슬래시(백업) — 주 조작은 버튼
  SLASH_WANION1 = "/wanion"
  SLASH_WANION2 = "/와니온"
  SlashCmdList["WANION"] = function() UI.toggle() end
  print("|cff8a70ff와니온 어시스트|r 로드됨 — 미니맵 버튼 또는 /wanion 으로 창을 여세요.")
end)
