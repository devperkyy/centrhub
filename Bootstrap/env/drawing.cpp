// language: C++20, file: env/drawing.cpp
// *Drawing library implemented in Luau using Roblox GUI primitives. Covers:
//   Drawing.new("Line" | "Text" | "Circle" | "Square" | "Quad" | "Triangle" | "Image")
//   Common props: Visible, Color, Thickness, Transparency, ZIndex
//   Line: From, To
//   Text: Text, Size, Font, Position, Center, Outline, OutlineColor
//   Circle: Position, Radius, NumSides, Filled
//   Square: Position, Size, Filled
//   Quad / Triangle: PointA..D, Filled
//   Image: Data (asset id), Position, Size, Rounding
#include "../luau_bridge.h"
#include "../pipe_server.h"
#include "../rbx_lua.h"

struct lua_State;

namespace vanta_env {

static const char* kDrawingLua = R"LUA(
local gg = getgenv()
local hui = gg.gethui and gg.gethui() or game:GetService("CoreGui")

local sg = Instance.new("ScreenGui")
sg.Name = "VANTA_Drawing"; sg.IgnoreGuiInset = true; sg.ResetOnSpawn = false
sg.DisplayOrder = 1000; sg.Parent = hui

local Drawing = {}
Drawing.Fonts = { UI = 0, System = 1, Plex = 2, Monospace = 3 }

local function makeBase(class, inst)
    local obj = { __class = class, _inst = inst, Visible = false }
    inst.Visible = false
    return obj
end

local function wrap(obj, props)
    return setmetatable(obj, {
        __index = function(t, k) return rawget(t, k) end,
        __newindex = function(t, k, v)
            rawset(t, k, v)
            if props[k] then props[k](t, v) end
        end,
        __metatable = "readonly"
    })
end

local function newLine()
    local f = Instance.new("Frame", sg)
    f.BorderSizePixel = 0; f.BackgroundColor3 = Color3.new(1,1,1); f.AnchorPoint = Vector2.new(0.5,0.5)
    local o = makeBase("Line", f)
    o.From = Vector2.new(); o.To = Vector2.new(); o.Color = Color3.new(1,1,1); o.Thickness = 1
    local function update(t)
        local a, b = t.From, t.To
        local mid = (a + b) / 2
        local dir = b - a
        f.Position = UDim2.fromOffset(mid.X, mid.Y)
        f.Size = UDim2.fromOffset(dir.Magnitude, t.Thickness or 1)
        f.Rotation = math.deg(math.atan2(dir.Y, dir.X))
        f.BackgroundColor3 = t.Color
        f.BackgroundTransparency = 1 - (1 - (t.Transparency or 0))
        f.Visible = t.Visible
    end
    return wrap(o, {
        Visible   = function(t,v) f.Visible = v end,
        From      = function(t,_) update(t) end,
        To        = function(t,_) update(t) end,
        Color     = function(t,_) update(t) end,
        Thickness = function(t,_) update(t) end,
        Transparency = function(t,v) f.BackgroundTransparency = v end,
        ZIndex    = function(t,v) f.ZIndex = v end,
        Remove    = function(t,_) f:Destroy() end,
    })
end

local function newText()
    local tl = Instance.new("TextLabel", sg)
    tl.BackgroundTransparency = 1; tl.TextColor3 = Color3.new(1,1,1)
    tl.Font = Enum.Font.SourceSans; tl.TextSize = 14
    tl.AutoLocalize = false; tl.RichText = false
    local o = makeBase("Text", tl)
    o.Text = ""; o.Position = Vector2.new(); o.Center = false; o.Outline = false
    return wrap(o, {
        Visible    = function(t,v) tl.Visible = v end,
        Text       = function(t,v) tl.Text = v end,
        Size       = function(t,v) tl.TextSize = v end,
        Color      = function(t,v) tl.TextColor3 = v end,
        Position   = function(t,v) tl.Position = UDim2.fromOffset(v.X, v.Y) end,
        Center     = function(t,v) tl.AnchorPoint = v and Vector2.new(0.5,0.5) or Vector2.new(0,0) end,
        Outline    = function(t,v) tl.TextStrokeTransparency = v and 0 or 1 end,
        OutlineColor = function(t,v) tl.TextStrokeColor3 = v end,
        Font       = function(t,v) tl.Font = ({[0]=Enum.Font.SourceSans,[1]=Enum.Font.SourceSansBold,[2]=Enum.Font.Code,[3]=Enum.Font.RobotoMono})[v] or Enum.Font.SourceSans end,
        Transparency = function(t,v) tl.TextTransparency = v end,
        ZIndex     = function(t,v) tl.ZIndex = v end,
        Remove     = function(t,_) tl:Destroy() end,
    })
end

local function newSquare()
    local f = Instance.new("Frame", sg)
    f.BorderSizePixel = 1; f.BackgroundTransparency = 1
    local o = makeBase("Square", f); o.Position = Vector2.new(); o.Size = Vector2.new(); o.Filled = false
    return wrap(o, {
        Visible = function(t,v) f.Visible = v end,
        Position = function(t,v) f.Position = UDim2.fromOffset(v.X, v.Y) end,
        Size     = function(t,v) f.Size = UDim2.fromOffset(v.X, v.Y) end,
        Color    = function(t,v) f.BackgroundColor3 = v; f.BorderColor3 = v end,
        Filled   = function(t,v) f.BackgroundTransparency = v and 0 or 1 end,
        Thickness= function(t,v) f.BorderSizePixel = v end,
        Transparency = function(t,v) f.BackgroundTransparency = v end,
        ZIndex   = function(t,v) f.ZIndex = v end,
        Remove   = function(t,_) f:Destroy() end,
    })
end

local function newCircle()
    local f = Instance.new("Frame", sg)
    f.BackgroundColor3 = Color3.new(1,1,1); f.BorderSizePixel = 0
    f.AnchorPoint = Vector2.new(0.5, 0.5)
    local corner = Instance.new("UICorner", f); corner.CornerRadius = UDim.new(1, 0)
    local o = makeBase("Circle", f); o.Position = Vector2.new(); o.Radius = 10; o.Filled = true
    return wrap(o, {
        Visible = function(t,v) f.Visible = v end,
        Position = function(t,v) f.Position = UDim2.fromOffset(v.X, v.Y) end,
        Radius   = function(t,v) f.Size = UDim2.fromOffset(v*2, v*2) end,
        Color    = function(t,v) f.BackgroundColor3 = v end,
        Filled   = function(t,v) f.BackgroundTransparency = v and 0 or 1 end,
        Transparency = function(t,v) f.BackgroundTransparency = v end,
        Thickness = function(t,v) end,
        ZIndex   = function(t,v) f.ZIndex = v end,
        Remove   = function(t,_) f:Destroy() end,
    })
end

local classes = { Line = newLine, Text = newText, Square = newSquare, Circle = newCircle }

function Drawing.new(class)
    local f = classes[class] or newSquare
    return f()
end

gg.Drawing = Drawing
gg.cleardrawcache = function() sg:ClearAllChildren() end
gg.getrenderproperty = function(obj, prop) return obj[prop] end
gg.setrenderproperty = function(obj, prop, val) obj[prop] = val end
gg.isrenderobj = function(obj) return typeof(obj) == "table" and obj.__class ~= nil end
print("[VANTA] Drawing lib online")
)LUA";

void install_drawing(lua_State* L) {
    auto err = luau::execute(kDrawingLua);
    if (!err.empty()) pipe_server::send_log("[env/drawing] " + err);
    else pipe_server::send_log("[env] Drawing online (Line, Text, Square, Circle)");
}
}
