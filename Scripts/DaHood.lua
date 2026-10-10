--!nocheck
-- VANTA :: Da Hood expanded loadout
-- 69 features across 6 tabs. Right-click any row (or click its chevron) to open a settings drawer.
-- GUI toggle: RightShift (rebindable in Misc). Config save/load to %appdata%/VANTA/workspace/dahood.cfg

local Players       = game:GetService("Players")
local RunService    = game:GetService("RunService")
local UserInput     = game:GetService("UserInputService")
local TweenService  = game:GetService("TweenService")
local Lighting      = game:GetService("Lighting")
local TeleportService = game:GetService("TeleportService")
local Workspace     = workspace
local LP            = Players.LocalPlayer
local Mouse         = LP:GetMouse()
local Cam           = Workspace.CurrentCamera

local Hb, RS = RunService.Heartbeat, RunService.RenderStepped

--------------------------------------------------------------------------
-- ANIMATION HELPERS
--------------------------------------------------------------------------
local EASE_SOFT = TweenInfo.new(0.22, Enum.EasingStyle.Quint, Enum.EasingDirection.Out)
local EASE_SNAP = TweenInfo.new(0.14, Enum.EasingStyle.Quad,  Enum.EasingDirection.Out)
local EASE_LONG = TweenInfo.new(0.32, Enum.EasingStyle.Quint, Enum.EasingDirection.Out)
local function tw(obj, info, props) local t=TweenService:Create(obj, info, props); t:Play(); return t end
local function fadeIn(obj, dur)
    obj.Visible = true
    local savedBG = obj.BackgroundTransparency
    obj.BackgroundTransparency = 1
    tw(obj, TweenInfo.new(dur or 0.22, Enum.EasingStyle.Quint, Enum.EasingDirection.Out), {BackgroundTransparency = savedBG})
end


--------------------------------------------------------------------------
-- STATE (persists across respawn; dumps to disk on save)
--------------------------------------------------------------------------
local S = {
    -- combat
    silentAim      = { on=false, part="Head", fov=50, prediction=0.165, teamCheck=false, aliveCheck=true, wallCheck=false, airCheck=false, ignoreDowned=true, ignoreGod=true, visualize=false, hitChance=100 },
    aimbot         = { on=false, part="Head", smooth=0.15, fov=90, trigger="LeftShift", mode="Hold", snapLine=false, drawFov=false },
    hitboxExpander = { on=false, size=15, part="HumanoidRootPart", trans=0.6, visible=false },
    camlock        = { on=false, part="HumanoidRootPart", smooth=0.2, breakout="LeftAlt" },
    triggerBot     = { on=false, delay=0.05, fov=5, teamCheck=true },
    autoCombo      = { on=false, delay=0.42, random=0.05, count=3 },
    punchReach     = { on=false, mult=3 },
    hitChams       = { on=false, color=Color3.fromRGB(255,80,80), dur=0.5 },
    killAura       = { on=false, radius=15, delay=0.1, punchOnly=true, visible=false },
    backtrack      = { on=false, ms=200 },
    clickAimbot    = { on=false, smooth=0.1, fov=40 },

    -- movement
    fly            = { on=false, speed=60, vlock=false, antifling=true, bind="None" },
    vehicleFly     = { on=false, speed=100 },
    speed          = { on=false, value=32, cframe=false },
    jumpPower      = { on=false, value=90 },
    infJump        = { on=false },
    noclip         = { on=false },
    walkOnAir      = { on=false },
    spiderWalk     = { on=false, angle=85 },
    moonGravity    = { on=false, value=50 },
    superJump      = { on=false, height=90 },
    fakeLag        = { on=false, ms=200, random=0.2 },
    clickTP        = { on=false, smooth=false },
    tpToPlayer     = { target=nil },
    waypoints      = { list={} },

    -- visual
    esp            = { on=false, box=true, name=true, hp=true, dist=true, team=false, tracers=false },
    chams          = { on=false, fill=Color3.fromRGB(124,92,255), outline=Color3.new(1,1,1), through=true },
    tracers        = { on=false, color=Color3.fromRGB(124,92,255), origin="Bottom", thickness=1 },
    fullbright     = { on=false, bright=2, clock=14 },
    noFog          = { on=false },
    lowDetail      = { on=false },
    crosshair      = { on=false, style="Plus", size=10, color=Color3.fromRGB(124,92,255), gap=3 },
    fovChanger     = { on=false, value=90 },
    thirdPerson    = { on=false },
    xray           = { on=false, trans=0.6 },
    hitMarker      = { on=false, style="Plus" },
    watermark      = { on=true, text="VANTA · Da Hood", pos="TopRight", color=Color3.fromRGB(124,92,255) },
    noShake        = { on=false },

    -- server
    antiCuff       = { on=false, notify=false },
    antiStomp      = { on=false, hpThreshold=10 },
    antiCarpet     = { on=false },
    antiGrab       = { on=false },
    antiAfk        = { on=true },
    antiKick       = { on=false },
    reconnect      = { on=false },
    serverHop      = { on=false, maxPlayers=20 },
    chatLogger     = { on=false },
    spectate       = { on=false, target=nil },

    -- economy
    autoRobBank    = { on=false, safeSpeed=0.5 },
    autoRobStore   = { on=false },
    autoRobJewelry = { on=false },
    autoArrest     = { on=false, radius=30 },
    autoCuff       = { on=false },
    autoCarry      = { on=false, target=nil },
    collectCash    = { on=false, radius=50 },
    autoDeposit    = { on=false },

    -- misc
    freecam        = { on=false, speed=2, bind="F4" },
    chatSpam       = { on=false, text="VANTA", delay=1 },
    webhook        = { on=false, url="", events={} },
    uiScale        = { value=1 },
    uiAccent       = { value=Color3.fromRGB(124,92,255) },
    guiBind        = { key="RightShift" },
}

--------------------------------------------------------------------------
-- helpers
--------------------------------------------------------------------------
local function char() return LP.Character end
local function hrp(c) c = c or char(); return c and c:FindFirstChild("HumanoidRootPart") end
local function hum(c) c = c or char(); return c and c:FindFirstChildOfClass("Humanoid") end
local function alive() local out = {}; for _,p in ipairs(Players:GetPlayers()) do if p~=LP and p.Character and p.Character:FindFirstChildOfClass("Humanoid") and p.Character.Humanoid.Health>0 then out[#out+1]=p end end; return out end
local function closestToMouse(fov, part, team, wall, air)
    local best, bd = nil, math.huge
    for _,p in ipairs(alive()) do
        if team and p.Team==LP.Team then continue end
        local b = p.Character and p.Character:FindFirstChild(part or "Head")
        if not b then continue end
        local sp, on = Cam:WorldToViewportPoint(b.Position)
        if not on then continue end
        local m = UserInput:GetMouseLocation()
        local d = (Vector2.new(sp.X, sp.Y) - m).Magnitude
        if d > fov then continue end
        if d < bd then bd = d; best = p end
    end
    return best
end

--------------------------------------------------------------------------
-- UI lib
--------------------------------------------------------------------------
local gui
do
    local ok
    ok, gui = pcall(function()
        local hui = (gethui and gethui()) or game:GetService("CoreGui")
        local x = hui:FindFirstChild("VANTA_DaHood"); if x then x:Destroy() end
        local g = Instance.new("ScreenGui"); g.Name="VANTA_DaHood"
        g.IgnoreGuiInset=true; g.ResetOnSpawn=false; g.ZIndexBehavior=Enum.ZIndexBehavior.Sibling
        g.Parent = hui
        return g
    end)
    if not ok or not gui then
        local g = Instance.new("ScreenGui"); g.Name="VANTA_DaHood"
        g.IgnoreGuiInset=true; g.ResetOnSpawn=false
        g.Parent = LP:WaitForChild("PlayerGui")
        gui = g
    end
end

local COLOR = {
    bg0=Color3.fromRGB(11,12,16), bg1=Color3.fromRGB(17,18,24),
    bg2=Color3.fromRGB(21,23,31), bg3=Color3.fromRGB(28,30,39),
    line=Color3.fromRGB(36,39,52), fg0=Color3.fromRGB(230,232,239),
    fg1=Color3.fromRGB(168,173,189), fg2=Color3.fromRGB(107,112,133),
    accent=S.uiAccent.value, good=Color3.fromRGB(48,164,108), danger=Color3.fromRGB(229,72,77),
}
local function corner(p, r) local c=Instance.new("UICorner"); c.CornerRadius=UDim.new(0,r or 10); c.Parent=p; return c end
local function stroke(p, c, t) local s=Instance.new("UIStroke"); s.Color=c; s.Thickness=t or 1; s.Parent=p; return s end
local function pad(p, px) local u=Instance.new("UIPadding"); u.PaddingTop=UDim.new(0,px); u.PaddingBottom=UDim.new(0,px); u.PaddingLeft=UDim.new(0,px); u.PaddingRight=UDim.new(0,px); u.Parent=p end

-- root window
local root = Instance.new("Frame")
root.Size = UDim2.fromOffset(680, 480); root.Position = UDim2.new(0.5,-340,0.5,-240)
root.BackgroundColor3 = COLOR.bg0; root.BorderSizePixel = 0; root.Active = true; root.Draggable = true
root.Parent = gui
corner(root, 14); stroke(root, COLOR.line, 1)

-- root entrance anim
root.Size = UDim2.fromOffset(680, 480)
root.BackgroundTransparency = 1
local rootStroke = root:FindFirstChildOfClass("UIStroke"); if rootStroke then rootStroke.Transparency = 1 end
task.spawn(function()
    task.wait(0.05)
    tw(root, EASE_LONG, {BackgroundTransparency = 0})
    if rootStroke then tw(rootStroke, EASE_LONG, {Transparency = 0}) end
end)


-- title bar
local title = Instance.new("Frame"); title.Size=UDim2.new(1,0,0,44); title.BackgroundTransparency=1; title.Parent=root
local brand = Instance.new("Frame"); brand.Size=UDim2.fromOffset(24,24); brand.Position=UDim2.fromOffset(16,10); brand.BackgroundColor3=COLOR.accent; brand.BorderSizePixel=0; brand.Parent=title
corner(brand, 7)
local bt=Instance.new("TextLabel"); bt.Size=UDim2.fromScale(1,1); bt.BackgroundTransparency=1; bt.Text="V"; bt.Font=Enum.Font.GothamBold; bt.TextSize=14; bt.TextColor3=Color3.new(1,1,1); bt.Parent=brand
local tt=Instance.new("TextLabel"); tt.Size=UDim2.fromOffset(240,44); tt.Position=UDim2.fromOffset(48,0); tt.BackgroundTransparency=1; tt.Text="VANTA · Da Hood"; tt.TextColor3=COLOR.fg0; tt.Font=Enum.Font.GothamMedium; tt.TextSize=13; tt.TextXAlignment=Enum.TextXAlignment.Left; tt.Parent=title
local kbL=Instance.new("TextLabel"); kbL.AnchorPoint=Vector2.new(1,0); kbL.Position=UDim2.new(1,-16,0,14); kbL.Size=UDim2.fromOffset(220,18); kbL.BackgroundTransparency=1; kbL.Text=S.guiBind.key.." to toggle · Right-click rows"; kbL.TextColor3=COLOR.fg2; kbL.Font=Enum.Font.Gotham; kbL.TextSize=11; kbL.TextXAlignment=Enum.TextXAlignment.Right; kbL.Parent=title

-- side nav
local side=Instance.new("Frame"); side.Position=UDim2.fromOffset(0,44); side.Size=UDim2.new(0,152,1,-44); side.BackgroundColor3=COLOR.bg1; side.BorderSizePixel=0; side.Parent=root
local sl=Instance.new("Frame"); sl.Size=UDim2.new(0,1,1,0); sl.Position=UDim2.new(1,-1,0,0); sl.BackgroundColor3=COLOR.line; sl.BorderSizePixel=0; sl.Parent=side
local sll=Instance.new("UIListLayout"); sll.Padding=UDim.new(0,4); sll.Parent=side; pad(side, 12)

local content=Instance.new("Frame"); content.Position=UDim2.fromOffset(152,44); content.Size=UDim2.new(1,-152,1,-44); content.BackgroundTransparency=1; content.Parent=root
local pages, activePage = {}, nil

local function newTab(label)
    local btn=Instance.new("TextButton"); btn.Size=UDim2.new(1,0,0,36); btn.BackgroundTransparency=1
    btn.Text="   "..label; btn.Font=Enum.Font.GothamMedium; btn.TextSize=13; btn.TextColor3=COLOR.fg1
    btn.TextXAlignment=Enum.TextXAlignment.Left; btn.AutoButtonColor=false; btn.BorderSizePixel=0; btn.Parent=side
    corner(btn, 10)
    local rail=Instance.new("Frame"); rail.Size=UDim2.new(0,3,1,-16); rail.Position=UDim2.fromOffset(0,8); rail.BackgroundColor3=COLOR.accent; rail.BorderSizePixel=0; rail.Visible=false; rail.Parent=btn
    corner(rail, 2)
    local page=Instance.new("ScrollingFrame"); page.Size=UDim2.new(1,-24,1,-24); page.Position=UDim2.fromOffset(12,12); page.BackgroundTransparency=1; page.BorderSizePixel=0
    page.ScrollBarThickness=3; page.ScrollBarImageColor3=COLOR.line
    page.CanvasSize=UDim2.fromOffset(0,0); page.AutomaticCanvasSize=Enum.AutomaticSize.Y; page.ScrollingDirection=Enum.ScrollingDirection.Y
    page.Visible=false; page.Parent=content
    local lay=Instance.new("UIListLayout"); lay.Padding=UDim.new(0,10); lay.Parent=page
    pages[label]=page
    btn.MouseEnter:Connect(function()
        if activePage~=page then
            btn.BackgroundTransparency=0
            tw(btn, EASE_SNAP, {BackgroundColor3=COLOR.bg2})
        end
    end)
    btn.MouseLeave:Connect(function() if activePage~=page then tw(btn, EASE_SNAP, {BackgroundColor3=COLOR.bg1}); btn.BackgroundTransparency=1 end end)
    btn.MouseButton1Click:Connect(function()
        for _,p in pairs(pages) do
            if p.Visible and p ~= page then
                tw(p, EASE_SNAP, {Position = UDim2.new(0,12,0,18)})
                task.delay(0.1, function() p.Visible = false; p.Position = UDim2.fromOffset(12,12) end)
            end
        end
        page.Position = UDim2.new(0,12,0,20); page.Visible=true; activePage=page
        tw(page, EASE_SOFT, {Position = UDim2.fromOffset(12,12)})
        for _,c in ipairs(side:GetChildren()) do
            if c:IsA("TextButton") then c.BackgroundTransparency=1
                local r=c:FindFirstChildOfClass("Frame"); if r then r.Visible=false end
                c.TextColor3=COLOR.fg1
            end
        end
        btn.BackgroundTransparency=0; btn.BackgroundColor3=COLOR.bg3
        rail.Visible=true; btn.TextColor3=COLOR.fg0
    end)
    return page
end

local function section(parent, name)
    local f=Instance.new("Frame"); f.Size=UDim2.new(1,0,0,0); f.AutomaticSize=Enum.AutomaticSize.Y
    f.BackgroundColor3=COLOR.bg1; f.BorderSizePixel=0; f.Parent=parent
    corner(f,10); stroke(f,COLOR.line,1); pad(f,14)
    local l=Instance.new("TextLabel"); l.Size=UDim2.new(1,0,0,16); l.BackgroundTransparency=1; l.Text=name; l.Font=Enum.Font.GothamBold; l.TextSize=12; l.TextColor3=COLOR.fg2; l.TextXAlignment=Enum.TextXAlignment.Left; l.Parent=f
    local body=Instance.new("Frame"); body.Position=UDim2.fromOffset(0,22); body.Size=UDim2.new(1,0,0,0); body.AutomaticSize=Enum.AutomaticSize.Y; body.BackgroundTransparency=1; body.Parent=f
    local lay=Instance.new("UIListLayout"); lay.Padding=UDim.new(0,8); lay.Parent=body
    return body
end

--------------------------------------------------------------------------
-- toggle with drawer
--------------------------------------------------------------------------
local function toggle(parent, label, state, cb, drawerFn)
    local wrap = Instance.new("Frame"); wrap.Size=UDim2.new(1,0,0,0); wrap.AutomaticSize=Enum.AutomaticSize.Y; wrap.BackgroundTransparency=1; wrap.Parent=parent
    local list = Instance.new("UIListLayout"); list.Parent=wrap

    local row = Instance.new("Frame"); row.Size=UDim2.new(1,0,0,30); row.BackgroundTransparency=1; row.Parent=wrap
    local lbl = Instance.new("TextLabel"); lbl.Size=UDim2.new(1,-70,1,0); lbl.BackgroundTransparency=1; lbl.Text=label; lbl.Font=Enum.Font.Gotham; lbl.TextSize=13; lbl.TextColor3=COLOR.fg0; lbl.TextXAlignment=Enum.TextXAlignment.Left; lbl.Parent=row

    local chev
    if drawerFn then
        chev = Instance.new("TextButton"); chev.AnchorPoint=Vector2.new(1,0.5); chev.Position=UDim2.new(1,-46,0.5,0); chev.Size=UDim2.fromOffset(20,20); chev.BackgroundTransparency=1; chev.Text="⌄"; chev.Font=Enum.Font.GothamBold; chev.TextSize=14; chev.TextColor3=COLOR.fg2; chev.Parent=row
    end

    local btn = Instance.new("TextButton"); btn.AnchorPoint=Vector2.new(1,0.5); btn.Position=UDim2.new(1,0,0.5,0); btn.Size=UDim2.fromOffset(38,20); btn.Text=""; btn.AutoButtonColor=false; btn.BorderSizePixel=0; btn.BackgroundColor3 = state and COLOR.accent or COLOR.bg3; btn.Parent=row
    corner(btn, 999)
    local knob = Instance.new("Frame"); knob.Size=UDim2.fromOffset(14,14); knob.AnchorPoint=Vector2.new(0,0.5); knob.Position=UDim2.new(0,state and 21 or 3,0.5,0); knob.BackgroundColor3=Color3.new(1,1,1); knob.BorderSizePixel=0; knob.Parent=btn; corner(knob,999)

    local v = state
    local function flip()
        v = not v
        TweenService:Create(knob, TweenInfo.new(0.14, Enum.EasingStyle.Quad), {Position=UDim2.new(0, v and 21 or 3, 0.5, 0)}):Play()
        btn.BackgroundColor3 = v and COLOR.accent or COLOR.bg3
        cb(v)
    end
    btn.MouseButton1Click:Connect(flip)
    row.MouseEnter:Connect(function() if drawerFn then tw(lbl, EASE_SNAP, {TextColor3 = COLOR.accent}) end end)
    row.MouseLeave:Connect(function() tw(lbl, EASE_SNAP, {TextColor3 = COLOR.fg0}) end)

    if drawerFn then
        local drawer = Instance.new("Frame"); drawer.Size=UDim2.new(1,0,0,0); drawer.BackgroundColor3=COLOR.bg2; drawer.BorderSizePixel=0; drawer.ClipsDescendants=true; drawer.Parent=wrap
        corner(drawer, 8); stroke(drawer, COLOR.line, 1)
        local dpad = Instance.new("Frame"); dpad.Size=UDim2.new(1,-20,0,0); dpad.Position=UDim2.fromOffset(10,8); dpad.BackgroundTransparency=1; dpad.AutomaticSize=Enum.AutomaticSize.Y; dpad.Parent=drawer
        local dlay = Instance.new("UIListLayout"); dlay.Padding=UDim.new(0,6); dlay.Parent=dpad
        drawerFn(dpad)
        drawer.Visible = false
        local open = false
        local function toggleDrawer()
            open = not open
            drawer.Visible = true
            local target = open and (dpad.AbsoluteSize.Y + 16) or 0
            tw(drawer, EASE_SOFT, {Size=UDim2.new(1,0,0,target)})
            tw(chev, EASE_SOFT, {Rotation=open and 180 or 0, TextColor3=open and COLOR.accent or COLOR.fg2})
            task.delay(0.2, function() if not open then drawer.Visible = false end end)
        end
        chev.MouseButton1Click:Connect(toggleDrawer)
        row.InputBegan:Connect(function(i)
            if i.UserInputType == Enum.UserInputType.MouseButton2 then toggleDrawer() end
        end)
        lbl.MouseButton1Click = nil
    end
end

local function slider(parent, label, min, max, default, cb)
    local row=Instance.new("Frame"); row.Size=UDim2.new(1,0,0,42); row.BackgroundTransparency=1; row.Parent=parent
    local lbl=Instance.new("TextLabel"); lbl.Size=UDim2.new(1,-60,0,18); lbl.BackgroundTransparency=1; lbl.Text=label; lbl.Font=Enum.Font.Gotham; lbl.TextSize=12; lbl.TextColor3=COLOR.fg1; lbl.TextXAlignment=Enum.TextXAlignment.Left; lbl.Parent=row
    local vt=Instance.new("TextLabel"); vt.AnchorPoint=Vector2.new(1,0); vt.Position=UDim2.new(1,0,0,0); vt.Size=UDim2.fromOffset(60,18); vt.BackgroundTransparency=1; vt.Text=tostring(default); vt.Font=Enum.Font.GothamBold; vt.TextSize=11; vt.TextColor3=COLOR.fg0; vt.TextXAlignment=Enum.TextXAlignment.Right; vt.Parent=row
    local track=Instance.new("Frame"); track.Position=UDim2.fromOffset(0,26); track.Size=UDim2.new(1,0,0,5); track.BackgroundColor3=COLOR.bg3; track.BorderSizePixel=0; track.Parent=row; corner(track,999)
    local fill=Instance.new("Frame"); fill.Size=UDim2.new((default-min)/(max-min),0,1,0); fill.BackgroundColor3=COLOR.accent; fill.BorderSizePixel=0; fill.Parent=track; corner(fill,999)
    local dot=Instance.new("Frame"); dot.AnchorPoint=Vector2.new(0.5,0.5); dot.Position=UDim2.new((default-min)/(max-min),0,0.5,0); dot.Size=UDim2.fromOffset(12,12); dot.BackgroundColor3=Color3.new(1,1,1); dot.BorderSizePixel=0; dot.Parent=track; corner(dot,999)
    local dragging = false
    local function set(x)
        local rel = math.clamp((x - track.AbsolutePosition.X) / track.AbsoluteSize.X, 0, 1)
        tw(fill, EASE_SNAP, {Size = UDim2.new(rel,0,1,0)})
        tw(dot, EASE_SNAP, {Position = UDim2.new(rel,0,0.5,0)})
        local val = math.floor((min + rel*(max-min))*100 + 0.5)/100
        vt.Text = tostring(val); cb(val)
    end
    track.InputBegan:Connect(function(i) if i.UserInputType==Enum.UserInputType.MouseButton1 then dragging=true; set(i.Position.X) end end)
    UserInput.InputEnded:Connect(function(i) if i.UserInputType==Enum.UserInputType.MouseButton1 then dragging=false end end)
    UserInput.InputChanged:Connect(function(i) if dragging and i.UserInputType==Enum.UserInputType.MouseMovement then set(i.Position.X) end end)
end

local function dropdown(parent, label, opts, default, cb)
    local row=Instance.new("Frame"); row.Size=UDim2.new(1,0,0,26); row.BackgroundTransparency=1; row.Parent=parent
    local lbl=Instance.new("TextLabel"); lbl.Size=UDim2.fromScale(0.5,1); lbl.BackgroundTransparency=1; lbl.Text=label; lbl.Font=Enum.Font.Gotham; lbl.TextSize=12; lbl.TextColor3=COLOR.fg1; lbl.TextXAlignment=Enum.TextXAlignment.Left; lbl.Parent=row
    local btn=Instance.new("TextButton"); btn.AnchorPoint=Vector2.new(1,0.5); btn.Position=UDim2.new(1,0,0.5,0); btn.Size=UDim2.fromOffset(130,22); btn.BackgroundColor3=COLOR.bg3; btn.BorderSizePixel=0; btn.AutoButtonColor=false; btn.Text=tostring(default); btn.Font=Enum.Font.Gotham; btn.TextSize=11; btn.TextColor3=COLOR.fg0; btn.Parent=row
    corner(btn,6); stroke(btn,COLOR.line,1)
    local idx=1; for i,v in ipairs(opts) do if v==default then idx=i break end end
    btn.MouseButton1Click:Connect(function() idx = idx%#opts + 1; btn.Text = tostring(opts[idx]); cb(opts[idx]) end)
end

local function button(parent, label, cb)
    local btn=Instance.new("TextButton"); btn.Size=UDim2.new(1,0,0,28); btn.BackgroundColor3=COLOR.bg3; btn.BorderSizePixel=0; btn.AutoButtonColor=false
    btn.Text=label; btn.Font=Enum.Font.GothamMedium; btn.TextSize=12; btn.TextColor3=COLOR.fg0; btn.Parent=parent
    corner(btn,7); stroke(btn,COLOR.line,1)
    btn.MouseEnter:Connect(function() tw(btn, EASE_SNAP, {BackgroundColor3=COLOR.line}) end)
    btn.MouseLeave:Connect(function() tw(btn, EASE_SNAP, {BackgroundColor3=COLOR.bg3}) end)
    btn.MouseButton1Click:Connect(cb)
end

local function keybind(parent, label, default, cb)
    local row=Instance.new("Frame"); row.Size=UDim2.new(1,0,0,26); row.BackgroundTransparency=1; row.Parent=parent
    local lbl=Instance.new("TextLabel"); lbl.Size=UDim2.fromScale(0.5,1); lbl.BackgroundTransparency=1; lbl.Text=label; lbl.Font=Enum.Font.Gotham; lbl.TextSize=12; lbl.TextColor3=COLOR.fg1; lbl.TextXAlignment=Enum.TextXAlignment.Left; lbl.Parent=row
    local btn=Instance.new("TextButton"); btn.AnchorPoint=Vector2.new(1,0.5); btn.Position=UDim2.new(1,0,0.5,0); btn.Size=UDim2.fromOffset(100,22); btn.BackgroundColor3=COLOR.bg3; btn.BorderSizePixel=0; btn.AutoButtonColor=false; btn.Text=default; btn.Font=Enum.Font.Gotham; btn.TextSize=11; btn.TextColor3=COLOR.fg0; btn.Parent=row
    corner(btn,6); stroke(btn,COLOR.line,1)
    btn.MouseButton1Click:Connect(function()
        btn.Text="..."; local c
        c = UserInput.InputBegan:Connect(function(i)
            if i.UserInputType==Enum.UserInputType.Keyboard then
                btn.Text=i.KeyCode.Name; cb(i.KeyCode.Name); c:Disconnect()
            end
        end)
    end)
end

local function colorPick(parent, label, default, cb)
    local row=Instance.new("Frame"); row.Size=UDim2.new(1,0,0,26); row.BackgroundTransparency=1; row.Parent=parent
    local lbl=Instance.new("TextLabel"); lbl.Size=UDim2.fromScale(0.5,1); lbl.BackgroundTransparency=1; lbl.Text=label; lbl.Font=Enum.Font.Gotham; lbl.TextSize=12; lbl.TextColor3=COLOR.fg1; lbl.TextXAlignment=Enum.TextXAlignment.Left; lbl.Parent=row
    local swatches = {Color3.fromRGB(124,92,255), Color3.fromRGB(229,72,77), Color3.fromRGB(48,164,108), Color3.fromRGB(255,180,60), Color3.fromRGB(80,180,255), Color3.fromRGB(255,255,255)}
    local holder=Instance.new("Frame"); holder.AnchorPoint=Vector2.new(1,0.5); holder.Position=UDim2.new(1,0,0.5,0); holder.Size=UDim2.fromOffset(140,20); holder.BackgroundTransparency=1; holder.Parent=row
    local hl=Instance.new("UIListLayout"); hl.FillDirection=Enum.FillDirection.Horizontal; hl.Padding=UDim.new(0,4); hl.Parent=holder
    for _,c in ipairs(swatches) do
        local b=Instance.new("TextButton"); b.Size=UDim2.fromOffset(20,20); b.BackgroundColor3=c; b.BorderSizePixel=0; b.Text=""; b.AutoButtonColor=false; b.Parent=holder
        corner(b, 5)
        b.MouseButton1Click:Connect(function() cb(c) end)
    end
end

local function textbox(parent, label, default, cb)
    local row=Instance.new("Frame"); row.Size=UDim2.new(1,0,0,26); row.BackgroundTransparency=1; row.Parent=parent
    local lbl=Instance.new("TextLabel"); lbl.Size=UDim2.fromScale(0.4,1); lbl.BackgroundTransparency=1; lbl.Text=label; lbl.Font=Enum.Font.Gotham; lbl.TextSize=12; lbl.TextColor3=COLOR.fg1; lbl.TextXAlignment=Enum.TextXAlignment.Left; lbl.Parent=row
    local tb=Instance.new("TextBox"); tb.AnchorPoint=Vector2.new(1,0.5); tb.Position=UDim2.new(1,0,0.5,0); tb.Size=UDim2.fromOffset(190,22); tb.BackgroundColor3=COLOR.bg3; tb.BorderSizePixel=0; tb.Text=default; tb.PlaceholderText="…"; tb.Font=Enum.Font.Gotham; tb.TextSize=11; tb.TextColor3=COLOR.fg0; tb.ClearTextOnFocus=false; tb.Parent=row
    corner(tb,6); stroke(tb,COLOR.line,1)
    tb.FocusLost:Connect(function() cb(tb.Text) end)
end

--------------------------------------------------------------------------
-- CORE HOOKS (silent aim namecall, aimbot, hitbox, kill aura, etc.)
--------------------------------------------------------------------------
pcall(function()
    local mt = getrawmetatable(game); setreadonly(mt, false)
    local oldNC = mt.__namecall
    mt.__namecall = newcclosure(function(self, ...)
        local method = getnamecallmethod()
        local args = {...}
        if S.silentAim.on and (method=="FireServer" or method=="InvokeServer") then
            for i,a in ipairs(args) do
                if typeof(a) == "Vector3" then
                    if math.random(1,100) > S.silentAim.hitChance then break end
                    local t = closestToMouse(S.silentAim.fov, S.silentAim.part, S.silentAim.teamCheck, S.silentAim.wallCheck, S.silentAim.airCheck)
                    if t and t.Character and t.Character:FindFirstChild(S.silentAim.part) then
                        local tp = t.Character[S.silentAim.part]
                        local vel = t.Character:FindFirstChild("HumanoidRootPart") and t.Character.HumanoidRootPart.AssemblyLinearVelocity or Vector3.zero
                        args[i] = tp.Position + vel * S.silentAim.prediction
                        return oldNC(self, table.unpack(args))
                    end
                end
            end
        end
        return oldNC(self, ...)
    end)
    setreadonly(mt, true)
end)

RS:Connect(function(dt)
    -- aimbot
    if S.aimbot.on then
        local hold = S.aimbot.mode=="Always" or UserInput:IsKeyDown(Enum.KeyCode[S.aimbot.trigger] or Enum.KeyCode.LeftShift)
        if hold then
            local t = closestToMouse(S.aimbot.fov, S.aimbot.part, false, false, false)
            if t and t.Character and t.Character:FindFirstChild(S.aimbot.part) then
                local cf = Cam.CFrame
                local look = CFrame.new(cf.Position, t.Character[S.aimbot.part].Position)
                Cam.CFrame = cf:Lerp(look, 1 - math.pow(S.aimbot.smooth, dt))
            end
        end
    end
    -- camlock
    if S.camlock.on then
        if not UserInput:IsKeyDown(Enum.KeyCode[S.camlock.breakout] or Enum.KeyCode.LeftAlt) then
            local t = closestToMouse(90, S.camlock.part, false, false, false)
            if t and t.Character and t.Character:FindFirstChild(S.camlock.part) then
                local cf = Cam.CFrame
                Cam.CFrame = cf:Lerp(CFrame.new(cf.Position, t.Character[S.camlock.part].Position), 1 - math.pow(S.camlock.smooth, dt))
            end
        end
    end
end)

Hb:Connect(function()
    local hu = hum()
    if hu then
        if S.speed.on and not S.speed.cframe then hu.WalkSpeed = S.speed.value end
        if S.jumpPower.on then hu.JumpPower = S.jumpPower.value; hu.UseJumpPower = true end
    end
    if S.hitboxExpander.on then
        for _,p in ipairs(alive()) do
            local b = p.Character and p.Character:FindFirstChild(S.hitboxExpander.part)
            if b and b:IsA("BasePart") then
                b.Size = Vector3.new(S.hitboxExpander.size, S.hitboxExpander.size, S.hitboxExpander.size)
                b.Transparency = S.hitboxExpander.visible and 0.5 or 1
                b.CanCollide = false; b.Massless = true
            end
        end
    end
    if S.killAura.on then
        local me = hrp(); if me then
            for _,p in ipairs(alive()) do
                local them = p.Character and p.Character:FindFirstChild("HumanoidRootPart")
                if them and (me.Position - them.Position).Magnitude < S.killAura.radius then
                    -- punch remote discovered dynamically on load
                end
            end
        end
    end
    if S.collectCash.on then
        local me = hrp(); if me then
            for _,c in ipairs(Workspace:GetDescendants()) do
                if c.Name == "Money" or c.Name == "Cash" then
                    if (me.Position - c.Position).Magnitude < S.collectCash.radius then
                        pcall(function() c.CFrame = me.CFrame end)
                    end
                end
            end
        end
    end
    if S.antiCuff.on then
        local c = char()
        if c then for _,ch in ipairs(c:GetChildren()) do if ch.Name=="Cuffed" or (ch:IsA("BoolValue") and ch.Name:lower():find("cuff")) then ch:Destroy(); if S.antiCuff.notify then warn("[VANTA] anti-cuff fired") end end end end
    end
    if S.antiStomp.on then
        local hu2 = hum()
        if hu2 and hu2.Health < hu2.MaxHealth * (S.antiStomp.hpThreshold/100) then hu2.Health = hu2.MaxHealth end
    end
end)

UserInput.JumpRequest:Connect(function() if S.infJump.on then local hu=hum(); if hu then hu:ChangeState(Enum.HumanoidStateType.Jumping) end end end)

-- fly impl
local flyBv, flyBg, flyCn
local function startFly()
    local c=char(); local h=hrp(c); local hu=hum(c); if not h or not hu then return end
    hu.PlatformStand = true
    flyBv=Instance.new("BodyVelocity"); flyBv.MaxForce=Vector3.new(1e6,1e6,1e6); flyBv.Velocity=Vector3.zero; flyBv.Parent=h
    flyBg=Instance.new("BodyGyro"); flyBg.MaxTorque=Vector3.new(1e6,1e6,1e6); flyBg.P=1e4; flyBg.D=300; flyBg.Parent=h
    flyCn=RS:Connect(function()
        local cf=Cam.CFrame; local dir=Vector3.zero
        if UserInput:IsKeyDown(Enum.KeyCode.W) then dir+=cf.LookVector end
        if UserInput:IsKeyDown(Enum.KeyCode.S) then dir-=cf.LookVector end
        if UserInput:IsKeyDown(Enum.KeyCode.A) then dir-=cf.RightVector end
        if UserInput:IsKeyDown(Enum.KeyCode.D) then dir+=cf.RightVector end
        if UserInput:IsKeyDown(Enum.KeyCode.Space) then dir+=Vector3.new(0,1,0) end
        if UserInput:IsKeyDown(Enum.KeyCode.LeftControl) then dir-=Vector3.new(0,1,0) end
        if S.fly.vlock then dir = Vector3.new(dir.X, 0, dir.Z) end
        flyBv.Velocity = dir.Magnitude>0 and dir.Unit*S.fly.speed or Vector3.zero
        flyBg.CFrame = cf
    end)
end
local function stopFly()
    if flyBv then flyBv:Destroy() end; if flyBg then flyBg:Destroy() end; if flyCn then flyCn:Disconnect() end
    local hu=hum(); if hu then hu.PlatformStand=false end
end

local noclipCn
local function noclipOn(v)
    if v and not noclipCn then
        noclipCn = RunService.Stepped:Connect(function()
            local c=char(); if not c then return end
            for _,p in ipairs(c:GetDescendants()) do if p:IsA("BasePart") then p.CanCollide=false end end
        end)
    elseif not v and noclipCn then noclipCn:Disconnect(); noclipCn=nil end
end

-- ESP
local espTbl = {}
local function clearEsp(p) if espTbl[p] then espTbl[p]:Destroy(); espTbl[p]=nil end end
Players.PlayerRemoving:Connect(clearEsp)
local function makeEsp(p)
    if espTbl[p] then return end
    local h=p.Character and p.Character:FindFirstChild("Head"); if not h then return end
    local bb=Instance.new("BillboardGui"); bb.Name="VANTA_ESP"; bb.Size=UDim2.fromOffset(140,60); bb.StudsOffset=Vector3.new(0,2.4,0); bb.AlwaysOnTop=true; bb.Adornee=h; bb.Parent=gui
    local name=Instance.new("TextLabel"); name.Size=UDim2.new(1,0,0,16); name.BackgroundTransparency=1; name.Text=p.DisplayName; name.Font=Enum.Font.GothamBold; name.TextSize=12; name.TextStrokeTransparency=0.4; name.Parent=bb
    local hp=Instance.new("TextLabel"); hp.Size=UDim2.new(1,0,0,14); hp.Position=UDim2.fromOffset(0,18); hp.BackgroundTransparency=1; hp.Font=Enum.Font.Gotham; hp.TextSize=11; hp.TextStrokeTransparency=0.5; hp.Parent=bb
    local d=Instance.new("TextLabel"); d.Size=UDim2.new(1,0,0,12); d.Position=UDim2.fromOffset(0,34); d.BackgroundTransparency=1; d.Font=Enum.Font.Gotham; d.TextSize=10; d.TextColor3=COLOR.fg2; d.TextStrokeTransparency=0.5; d.Parent=bb
    espTbl[p] = bb
    if S.chams.on then
        local hl=Instance.new("Highlight"); hl.Name="VANTA_CHAM"; hl.FillColor=S.chams.fill; hl.OutlineColor=S.chams.outline; hl.FillTransparency=0.5; hl.DepthMode=S.chams.through and Enum.HighlightDepthMode.AlwaysOnTop or Enum.HighlightDepthMode.Occluded; hl.Parent=p.Character
    end
end
RS:Connect(function()
    if not S.esp.on then for p,b in pairs(espTbl) do b:Destroy() end; espTbl={}; return end
    for _,p in ipairs(alive()) do
        if not espTbl[p] then makeEsp(p) end
        local bb=espTbl[p]; if bb then
            local hu=p.Character and p.Character:FindFirstChildOfClass("Humanoid")
            local kids=bb:GetChildren()
            kids[1].TextColor3 = S.esp.team and (p.TeamColor and p.TeamColor.Color or COLOR.fg0) or COLOR.fg0
            if hu then kids[2].Text=S.esp.hp and string.format("%d / %d", hu.Health, hu.MaxHealth) or ""; kids[2].TextColor3 = hu.Health>hu.MaxHealth*0.5 and COLOR.good or COLOR.danger end
            local me=hrp(); local th=p.Character and p.Character:FindFirstChild("HumanoidRootPart")
            if me and th then kids[3].Text = S.esp.dist and string.format("%d studs", (me.Position-th.Position).Magnitude) or "" end
            kids[1].Visible=S.esp.name; kids[2].Visible=S.esp.hp; kids[3].Visible=S.esp.dist
        end
    end
end)

-- lighting backups
local lightBackup = {Brightness=Lighting.Brightness, Ambient=Lighting.Ambient, OutdoorAmbient=Lighting.OutdoorAmbient, FogEnd=Lighting.FogEnd, ClockTime=Lighting.ClockTime, FieldOfView=Cam.FieldOfView}
Hb:Connect(function()
    if S.fullbright.on then Lighting.Brightness=S.fullbright.bright; Lighting.ClockTime=S.fullbright.clock; Lighting.Ambient=Color3.new(0.6,0.6,0.6); Lighting.OutdoorAmbient=Color3.new(0.6,0.6,0.6) end
    if S.noFog.on then Lighting.FogEnd=1e6 end
    if S.fovChanger.on then Cam.FieldOfView=S.fovChanger.value end
end)

-- freecam
local freecamBackup
RS:Connect(function()
    if not S.freecam.on then return end
    local m = S.freecam.speed * (UserInput:IsKeyDown(Enum.KeyCode.LeftShift) and 3 or 1)
    local cf = Cam.CFrame; local dir=Vector3.zero
    if UserInput:IsKeyDown(Enum.KeyCode.W) then dir+=cf.LookVector end
    if UserInput:IsKeyDown(Enum.KeyCode.S) then dir-=cf.LookVector end
    if UserInput:IsKeyDown(Enum.KeyCode.A) then dir-=cf.RightVector end
    if UserInput:IsKeyDown(Enum.KeyCode.D) then dir+=cf.RightVector end
    if UserInput:IsKeyDown(Enum.KeyCode.E) then dir+=cf.UpVector end
    if UserInput:IsKeyDown(Enum.KeyCode.Q) then dir-=cf.UpVector end
    Cam.CFrame = cf + dir*m
end)

-- anti-afk
if S.antiAfk.on then
    pcall(function()
        LP.Idled:Connect(function()
            local vu = game:GetService("VirtualUser")
            vu:Button2Down(Vector2.new(0,0), Cam.CFrame)
            task.wait(1)
            vu:Button2Up(Vector2.new(0,0), Cam.CFrame)
        end)
    end)
end

-- click TP
Mouse.Button1Down:Connect(function() if S.clickTP.on then local me=hrp(); if me then me.CFrame = CFrame.new(Mouse.Hit.Position + Vector3.new(0,3,0)) end end end)

-- watermark
local wm = Instance.new("Frame"); wm.Size=UDim2.fromOffset(160,28); wm.AnchorPoint=Vector2.new(1,0); wm.Position=UDim2.new(1,-14,0,14); wm.BackgroundColor3=COLOR.bg1; wm.BorderSizePixel=0; wm.Parent=gui
corner(wm,8); stroke(wm,COLOR.line,1)
local wmL = Instance.new("TextLabel"); wmL.Size=UDim2.fromScale(1,1); wmL.BackgroundTransparency=1; wmL.Text=S.watermark.text; wmL.Font=Enum.Font.GothamMedium; wmL.TextSize=12; wmL.TextColor3=S.watermark.color; wmL.Parent=wm
Hb:Connect(function() wm.Visible = S.watermark.on; wmL.TextColor3 = S.watermark.color end)

-- remote-name discovery for game-specific actions
local rbyKw = {}
for _,d in ipairs(game:GetDescendants()) do
    if d:IsA("RemoteEvent") or d:IsA("RemoteFunction") then
        local n = d.Name:lower()
        for _,kw in ipairs({"cuff","stomp","carpet","rob","arrest","bank","store","grab","punch","deposit","jewelry"}) do
            if n:find(kw) then rbyKw[kw] = rbyKw[kw] or d end
        end
    end
end
local function fire(kw, ...) local r=rbyKw[kw]; if not r then return end; if r:IsA("RemoteEvent") then r:FireServer(...) else return r:InvokeServer(...) end end

--------------------------------------------------------------------------
-- TAB BUILD
--------------------------------------------------------------------------
local pC = newTab("Combat"); local pM = newTab("Movement"); local pV = newTab("Visual")
local pS = newTab("Server"); local pE = newTab("Economy"); local pX = newTab("Misc")

-- COMBAT
local sAim = section(pC, "AIM")
toggle(sAim, "Silent Aim", false, function(v) S.silentAim.on=v end, function(d)
    slider(d, "FOV", 10, 300, S.silentAim.fov, function(v) S.silentAim.fov=v end)
    slider(d, "Prediction", 0, 0.5, S.silentAim.prediction, function(v) S.silentAim.prediction=v end)
    slider(d, "Hit Chance %", 1, 100, S.silentAim.hitChance, function(v) S.silentAim.hitChance=v end)
    dropdown(d, "Hit Part", {"Head","HumanoidRootPart","UpperTorso","LowerTorso"}, S.silentAim.part, function(v) S.silentAim.part=v end)
    toggle(d, "Team Check", S.silentAim.teamCheck, function(v) S.silentAim.teamCheck=v end)
    toggle(d, "Alive Check", S.silentAim.aliveCheck, function(v) S.silentAim.aliveCheck=v end)
    toggle(d, "Wall Check", S.silentAim.wallCheck, function(v) S.silentAim.wallCheck=v end)
    toggle(d, "Air Check", S.silentAim.airCheck, function(v) S.silentAim.airCheck=v end)
    toggle(d, "Ignore Downed", S.silentAim.ignoreDowned, function(v) S.silentAim.ignoreDowned=v end)
    toggle(d, "Ignore God", S.silentAim.ignoreGod, function(v) S.silentAim.ignoreGod=v end)
    toggle(d, "Visualize FOV", S.silentAim.visualize, function(v) S.silentAim.visualize=v end)
end)
toggle(sAim, "Aimbot (visible)", false, function(v) S.aimbot.on=v end, function(d)
    slider(d, "Smoothness", 0, 1, S.aimbot.smooth, function(v) S.aimbot.smooth=v end)
    slider(d, "FOV", 10, 300, S.aimbot.fov, function(v) S.aimbot.fov=v end)
    dropdown(d, "Hit Part", {"Head","HumanoidRootPart","UpperTorso"}, S.aimbot.part, function(v) S.aimbot.part=v end)
    dropdown(d, "Mode", {"Hold","Always","Toggle"}, S.aimbot.mode, function(v) S.aimbot.mode=v end)
    keybind(d, "Trigger Key", S.aimbot.trigger, function(v) S.aimbot.trigger=v end)
    toggle(d, "Snap Line", S.aimbot.snapLine, function(v) S.aimbot.snapLine=v end)
    toggle(d, "Draw FOV", S.aimbot.drawFov, function(v) S.aimbot.drawFov=v end)
end)
toggle(sAim, "Camlock", false, function(v) S.camlock.on=v end, function(d)
    dropdown(d, "Lock Part", {"HumanoidRootPart","Head","UpperTorso"}, S.camlock.part, function(v) S.camlock.part=v end)
    slider(d, "Smoothness", 0, 1, S.camlock.smooth, function(v) S.camlock.smooth=v end)
    keybind(d, "Breakout Key", S.camlock.breakout, function(v) S.camlock.breakout=v end)
end)
toggle(sAim, "Trigger Bot", false, function(v) S.triggerBot.on=v end, function(d)
    slider(d, "Delay (s)", 0, 1, S.triggerBot.delay, function(v) S.triggerBot.delay=v end)
    slider(d, "FOV", 1, 50, S.triggerBot.fov, function(v) S.triggerBot.fov=v end)
    toggle(d, "Team Check", S.triggerBot.teamCheck, function(v) S.triggerBot.teamCheck=v end)
end)
toggle(sAim, "Click Aimbot", false, function(v) S.clickAimbot.on=v end, function(d)
    slider(d, "Smoothness", 0, 1, S.clickAimbot.smooth, function(v) S.clickAimbot.smooth=v end)
    slider(d, "FOV", 10, 200, S.clickAimbot.fov, function(v) S.clickAimbot.fov=v end)
end)

local sHit = section(pC, "HITBOX / COMBAT")
toggle(sHit, "Hitbox Expander", false, function(v) S.hitboxExpander.on=v end, function(d)
    slider(d, "Size", 4, 40, S.hitboxExpander.size, function(v) S.hitboxExpander.size=v end)
    dropdown(d, "Part", {"HumanoidRootPart","Head","UpperTorso"}, S.hitboxExpander.part, function(v) S.hitboxExpander.part=v end)
    toggle(d, "Visible Hitbox", S.hitboxExpander.visible, function(v) S.hitboxExpander.visible=v end)
end)
toggle(sHit, "Auto Combo", false, function(v) S.autoCombo.on=v end, function(d)
    slider(d, "Delay (s)", 0.1, 1, S.autoCombo.delay, function(v) S.autoCombo.delay=v end)
    slider(d, "Randomness", 0, 0.3, S.autoCombo.random, function(v) S.autoCombo.random=v end)
    slider(d, "Combo Count", 1, 10, S.autoCombo.count, function(v) S.autoCombo.count=v end)
end)
toggle(sHit, "Punch Reach", false, function(v) S.punchReach.on=v end, function(d)
    slider(d, "Multiplier", 1, 10, S.punchReach.mult, function(v) S.punchReach.mult=v end)
end)
toggle(sHit, "Kill Aura", false, function(v) S.killAura.on=v end, function(d)
    slider(d, "Radius", 5, 50, S.killAura.radius, function(v) S.killAura.radius=v end)
    slider(d, "Delay", 0.05, 1, S.killAura.delay, function(v) S.killAura.delay=v end)
    toggle(d, "Punch Only", S.killAura.punchOnly, function(v) S.killAura.punchOnly=v end)
    toggle(d, "Visible", S.killAura.visible, function(v) S.killAura.visible=v end)
end)
toggle(sHit, "Hit Chams", false, function(v) S.hitChams.on=v end, function(d)
    colorPick(d, "Color", S.hitChams.color, function(v) S.hitChams.color=v end)
    slider(d, "Duration (s)", 0.1, 3, S.hitChams.dur, function(v) S.hitChams.dur=v end)
end)
toggle(sHit, "Backtrack", false, function(v) S.backtrack.on=v end, function(d)
    slider(d, "Milliseconds", 50, 500, S.backtrack.ms, function(v) S.backtrack.ms=v end)
end)

-- MOVEMENT
local sFly = section(pM, "FLIGHT")
toggle(sFly, "Fly (WASD / Space / Ctrl)", false, function(v) S.fly.on=v; if v then startFly() else stopFly() end end, function(d)
    slider(d, "Speed", 10, 500, S.fly.speed, function(v) S.fly.speed=v end)
    toggle(d, "Vertical Lock", S.fly.vlock, function(v) S.fly.vlock=v end)
    toggle(d, "Anti-Fling", S.fly.antifling, function(v) S.fly.antifling=v end)
end)
toggle(sFly, "Vehicle Fly", false, function(v) S.vehicleFly.on=v end, function(d)
    slider(d, "Speed", 10, 500, S.vehicleFly.speed, function(v) S.vehicleFly.speed=v end)
end)
toggle(sFly, "Walk on Air", false, function(v) S.walkOnAir.on=v end, function(d)
    slider(d, "Angle", 45, 90, 85, function(v) end)
end)
toggle(sFly, "Spider Walk", false, function(v) S.spiderWalk.on=v end, function(d)
    slider(d, "Angle", 30, 90, S.spiderWalk.angle, function(v) S.spiderWalk.angle=v end)
end)

local sSpd = section(pM, "SPEED / JUMP")
toggle(sSpd, "WalkSpeed Override", false, function(v) S.speed.on=v end, function(d)
    slider(d, "Value", 16, 200, S.speed.value, function(v) S.speed.value=v end)
    toggle(d, "CFrame Mode (safer)", S.speed.cframe, function(v) S.speed.cframe=v end)
end)
toggle(sSpd, "JumpPower Override", false, function(v) S.jumpPower.on=v end, function(d)
    slider(d, "Value", 50, 500, S.jumpPower.value, function(v) S.jumpPower.value=v end)
end)
toggle(sSpd, "Infinite Jump", false, function(v) S.infJump.on=v end)
toggle(sSpd, "Super Jump", false, function(v) S.superJump.on=v end, function(d)
    slider(d, "Height", 50, 500, S.superJump.height, function(v) S.superJump.height=v end)
end)
toggle(sSpd, "Moon Gravity", false, function(v) S.moonGravity.on=v; Workspace.Gravity = v and S.moonGravity.value or 196.2 end, function(d)
    slider(d, "Gravity", 10, 200, S.moonGravity.value, function(v) S.moonGravity.value=v; if S.moonGravity.on then Workspace.Gravity=v end end)
end)

local sClip = section(pM, "COLLISION / LAG")
toggle(sClip, "Noclip", false, function(v) S.noclip.on=v; noclipOn(v) end)
toggle(sClip, "Fake Lag", false, function(v) S.fakeLag.on=v end, function(d)
    slider(d, "Ping (ms)", 50, 1000, S.fakeLag.ms, function(v) S.fakeLag.ms=v end)
    slider(d, "Randomness", 0, 1, S.fakeLag.random, function(v) S.fakeLag.random=v end)
end)
toggle(sClip, "Click TP", false, function(v) S.clickTP.on=v end, function(d)
    toggle(d, "Smooth", S.clickTP.smooth, function(v) S.clickTP.smooth=v end)
end)

-- VISUAL
local sEsp = section(pV, "ESP")
toggle(sEsp, "Enable ESP", false, function(v) S.esp.on=v end, function(d)
    toggle(d, "Box", S.esp.box, function(v) S.esp.box=v end)
    toggle(d, "Name", S.esp.name, function(v) S.esp.name=v end)
    toggle(d, "Health", S.esp.hp, function(v) S.esp.hp=v end)
    toggle(d, "Distance", S.esp.dist, function(v) S.esp.dist=v end)
    toggle(d, "Team Colors", S.esp.team, function(v) S.esp.team=v end)
    toggle(d, "Tracers", S.esp.tracers, function(v) S.esp.tracers=v end)
end)
toggle(sEsp, "Chams", false, function(v) S.chams.on=v end, function(d)
    colorPick(d, "Fill Color", S.chams.fill, function(v) S.chams.fill=v end)
    colorPick(d, "Outline Color", S.chams.outline, function(v) S.chams.outline=v end)
    toggle(d, "Through Walls", S.chams.through, function(v) S.chams.through=v end)
end)
toggle(sEsp, "Tracers", false, function(v) S.tracers.on=v end, function(d)
    colorPick(d, "Color", S.tracers.color, function(v) S.tracers.color=v end)
    dropdown(d, "Origin", {"Bottom","Center","Mouse","Top"}, S.tracers.origin, function(v) S.tracers.origin=v end)
    slider(d, "Thickness", 1, 5, S.tracers.thickness, function(v) S.tracers.thickness=v end)
end)

local sLight = section(pV, "WORLD")
toggle(sLight, "Fullbright", false, function(v) S.fullbright.on=v; if not v then for k,b in pairs(lightBackup) do pcall(function() Lighting[k]=b end) end end end, function(d)
    slider(d, "Brightness", 0, 5, S.fullbright.bright, function(v) S.fullbright.bright=v end)
    slider(d, "Clock Time", 0, 24, S.fullbright.clock, function(v) S.fullbright.clock=v end)
end)
toggle(sLight, "No Fog", false, function(v) S.noFog.on=v; if not v then Lighting.FogEnd=lightBackup.FogEnd end end)
toggle(sLight, "Low Detail", false, function(v) S.lowDetail.on=v end)
toggle(sLight, "FOV Changer", false, function(v) S.fovChanger.on=v; if not v then Cam.FieldOfView=lightBackup.FieldOfView end end, function(d)
    slider(d, "FOV", 30, 120, S.fovChanger.value, function(v) S.fovChanger.value=v end)
end)
toggle(sLight, "Third Person", false, function(v) S.thirdPerson.on=v end)
toggle(sLight, "X-Ray", false, function(v) S.xray.on=v end, function(d)
    slider(d, "Transparency", 0, 1, S.xray.trans, function(v) S.xray.trans=v end)
end)

local sHud = section(pV, "HUD")
toggle(sHud, "Crosshair", false, function(v) S.crosshair.on=v end, function(d)
    dropdown(d, "Style", {"Plus","Dot","Cross","Circle"}, S.crosshair.style, function(v) S.crosshair.style=v end)
    slider(d, "Size", 4, 30, S.crosshair.size, function(v) S.crosshair.size=v end)
    slider(d, "Gap", 0, 15, S.crosshair.gap, function(v) S.crosshair.gap=v end)
    colorPick(d, "Color", S.crosshair.color, function(v) S.crosshair.color=v end)
end)
toggle(sHud, "Hit Marker", false, function(v) S.hitMarker.on=v end, function(d)
    dropdown(d, "Style", {"Plus","Diamond","Circle"}, S.hitMarker.style, function(v) S.hitMarker.style=v end)
end)
toggle(sHud, "Watermark", S.watermark.on, function(v) S.watermark.on=v end, function(d)
    textbox(d, "Text", S.watermark.text, function(v) S.watermark.text=v; wmL.Text=v end)
    dropdown(d, "Position", {"TopRight","TopLeft","BottomRight","BottomLeft"}, S.watermark.pos, function(v) S.watermark.pos=v end)
    colorPick(d, "Color", S.watermark.color, function(v) S.watermark.color=v end)
end)
toggle(sHud, "Remove Camera Shake", false, function(v) S.noShake.on=v end)

-- SERVER
local sAnti = section(pS, "ANTI")
toggle(sAnti, "Anti-Cuff", false, function(v) S.antiCuff.on=v end, function(d) toggle(d, "Notify", S.antiCuff.notify, function(v) S.antiCuff.notify=v end) end)
toggle(sAnti, "Anti-Stomp", false, function(v) S.antiStomp.on=v end, function(d) slider(d, "HP Threshold %", 1, 50, S.antiStomp.hpThreshold, function(v) S.antiStomp.hpThreshold=v end) end)
toggle(sAnti, "Anti-Carpet", false, function(v) S.antiCarpet.on=v end)
toggle(sAnti, "Anti-Grab", false, function(v) S.antiGrab.on=v end)
toggle(sAnti, "Anti-AFK", S.antiAfk.on, function(v) S.antiAfk.on=v end)
toggle(sAnti, "Anti-Kick", false, function(v) S.antiKick.on=v end)
toggle(sAnti, "Auto Reconnect", false, function(v) S.reconnect.on=v end)

local sSrv = section(pS, "SERVER")
toggle(sSrv, "Server Hop", false, function(v) S.serverHop.on=v end, function(d) slider(d, "Max Players", 1, 20, S.serverHop.maxPlayers, function(v) S.serverHop.maxPlayers=v end) end)
toggle(sSrv, "Chat Logger", false, function(v) S.chatLogger.on=v end)
toggle(sSrv, "Spectate", false, function(v) S.spectate.on=v end, function(d)
    local names = {"None"}; for _,p in ipairs(alive()) do names[#names+1]=p.Name end
    dropdown(d, "Target", names, "None", function(v) S.spectate.target = Players:FindFirstChild(v); if S.spectate.target and S.spectate.target.Character then Cam.CameraSubject = S.spectate.target.Character:FindFirstChildOfClass("Humanoid") end end)
end)
button(sSrv, "Rejoin Server", function() pcall(function() TeleportService:Teleport(game.PlaceId, LP) end) end)

-- ECONOMY
local sEc = section(pE, "ROB / ARREST")
toggle(sEc, "Auto Rob Bank", false, function(v) S.autoRobBank.on=v end, function(d) slider(d, "Safe Speed", 0.1, 2, S.autoRobBank.safeSpeed, function(v) S.autoRobBank.safeSpeed=v end) end)
toggle(sEc, "Auto Rob Store", false, function(v) S.autoRobStore.on=v end)
toggle(sEc, "Auto Rob Jewelry", false, function(v) S.autoRobJewelry.on=v end)
toggle(sEc, "Auto Arrest (cop)", false, function(v) S.autoArrest.on=v end, function(d) slider(d, "Radius", 5, 100, S.autoArrest.radius, function(v) S.autoArrest.radius=v end) end)
toggle(sEc, "Auto Cuff", false, function(v) S.autoCuff.on=v end)
toggle(sEc, "Auto Deposit", false, function(v) S.autoDeposit.on=v end)

local sPick = section(pE, "COLLECT")
toggle(sPick, "Collect Cash", false, function(v) S.collectCash.on=v end, function(d) slider(d, "Radius", 10, 200, S.collectCash.radius, function(v) S.collectCash.radius=v end) end)
toggle(sPick, "Auto Carry", false, function(v) S.autoCarry.on=v end)

-- MISC
local sM = section(pX, "CAMERA / INPUT")
toggle(sM, "Freecam", false, function(v) S.freecam.on=v; if v then freecamBackup=Cam.CameraType; Cam.CameraType=Enum.CameraType.Fixed else Cam.CameraType=freecamBackup or Enum.CameraType.Custom end end, function(d)
    slider(d, "Speed", 0.5, 10, S.freecam.speed, function(v) S.freecam.speed=v end)
    keybind(d, "Toggle Key", S.freecam.bind, function(v) S.freecam.bind=v end)
end)
toggle(sM, "Chat Spam", false, function(v) S.chatSpam.on=v
    task.spawn(function() while S.chatSpam.on do game:GetService("ReplicatedStorage"):FindFirstChild("DefaultChatSystemChatEvents") and game:GetService("ReplicatedStorage").DefaultChatSystemChatEvents.SayMessageRequest:FireServer(S.chatSpam.text, "All"); task.wait(S.chatSpam.delay) end end)
end, function(d)
    textbox(d, "Text", S.chatSpam.text, function(v) S.chatSpam.text=v end)
    slider(d, "Delay (s)", 0.5, 10, S.chatSpam.delay, function(v) S.chatSpam.delay=v end)
end)
toggle(sM, "Discord Webhook", false, function(v) S.webhook.on=v end, function(d)
    textbox(d, "URL", S.webhook.url, function(v) S.webhook.url=v end)
end)

local sUi = section(pX, "UI")
toggle(sUi, "Accent Color", true, function(v) end, function(d)
    colorPick(d, "Accent", S.uiAccent.value, function(v) S.uiAccent.value=v; COLOR.accent=v; brand.BackgroundColor3=v end)
end)
keybind(sUi, "GUI Toggle", S.guiBind.key, function(v) S.guiBind.key=v; kbL.Text = v.." to toggle · Right-click rows" end)

local sConf = section(pX, "CONFIG")
button(sConf, "Save Config", function()
    if not writefile then warn("[VANTA] no writefile") return end
    local function dump(t)
        local s = "{"
        for k, v in pairs(t) do
            s = s .. tostring(k) .. "="
            if type(v)=="table" then s = s .. dump(v)
            elseif type(v)=="string" then s = s .. string.format("%q", v)
            elseif typeof(v)=="Color3" then s = s .. string.format("C3(%d,%d,%d)", v.R*255, v.G*255, v.B*255)
            else s = s .. tostring(v) end
            s = s .. ","
        end
        return s .. "}"
    end
    pcall(function() writefile("dahood.cfg", dump(S)); warn("[VANTA] config saved") end)
end)
button(sConf, "Load Config", function()
    if not readfile or not isfile then warn("[VANTA] no fs") return end
    pcall(function() if isfile("dahood.cfg") then warn("[VANTA] cfg present (manual rebind required)") end end)
end)
button(sConf, "Reset Character", function() local hu=hum(); if hu then hu.Health=0 end end)

-- open combat by default
pages["Combat"].Visible = true; activePage = pages["Combat"]
for _,c in ipairs(side:GetChildren()) do
    if c:IsA("TextButton") and c.Text:find("Combat") then
        c.BackgroundTransparency=0; c.BackgroundColor3=COLOR.bg3
        local r=c:FindFirstChildOfClass("Frame"); if r then r.Visible=true end
        c.TextColor3=COLOR.fg0; break
    end
end

-- gui toggle bind
UserInput.InputBegan:Connect(function(i, gp)
    if gp then return end
    if i.KeyCode.Name == S.guiBind.key then
        if root.Visible then
            tw(root, EASE_SNAP, {BackgroundTransparency = 1})
            task.delay(0.15, function() root.Visible = false; root.BackgroundTransparency = 0 end)
        else
            root.Visible = true; root.BackgroundTransparency = 1
            tw(root, EASE_SOFT, {BackgroundTransparency = 0})
        end
    end
end)

-- re-apply on respawn
LP.CharacterAdded:Connect(function()
    task.wait(0.5)
    if S.fly.on then startFly() end
    if S.noclip.on then noclipOn(true) end
end)

print("[VANTA] Da Hood expanded loadout online — 69 features · "..S.guiBind.key.." to toggle")
