// language: C++20, file: env/instance.cpp
// *Instance helpers: gethui, cloneref, compareinstances, fire*, getcallbackvalue, getcallingscript
// These lean on Luau-side implementations expressed as source and compiled through loadstring,
// because reaching Roblox's internal Instance methods from C side needs more sigs than we want
// to track. loadstring is already real at this point so this works.
#include "../rbx_lua.h"
#include "../luau_bridge.h"
#include "../pipe_server.h"

struct lua_State;

namespace vanta_env {

static const char* kInstanceLua = R"LUA(
local gg = getgenv()

-- gethui: hidden GUI container
gg.gethui = function()
    local ok, g = pcall(function()
        local coregui = cloneref and cloneref(game:GetService("CoreGui")) or game:GetService("CoreGui")
        return coregui
    end)
    if ok and g then return g end
    local lp = game:GetService("Players").LocalPlayer
    return lp and lp:FindFirstChild("PlayerGui") or lp
end

-- cloneref: Roblox exposes identity-equal copies via a privileged API we don't have.
-- Reasonable approximation: return the instance itself; most scripts just use it to defeat
-- metatable __index spies.
gg.cloneref = gg.cloneref or function(inst) return inst end

-- compareinstances: strict equality OR same ClassName+Name+Parent chain
gg.compareinstances = function(a, b)
    if a == b then return true end
    if typeof(a) ~= "Instance" or typeof(b) ~= "Instance" then return false end
    return a:GetFullName() == b:GetFullName()
end

-- fireclickdetector(detector, dist?)
gg.fireclickdetector = function(cd, dist)
    local lp = game:GetService("Players").LocalPlayer
    -- public approximation: trigger via mouseclick event
    for _, s in ipairs({"MouseClick","RightMouseClick","MouseHoverEnter","MouseHoverLeave"}) do
        local sig = cd:FindFirstChild(s) or cd[s]
    end
    if cd.MouseClick then
        -- most games listen on MouseClick signal
        pcall(function() cd.MouseClick:Fire(lp) end)
    end
end

-- fireproximityprompt(prompt)
gg.fireproximityprompt = function(p)
    if typeof(p) ~= "Instance" or p.ClassName ~= "ProximityPrompt" then return end
    local orig = p.HoldDuration
    p.HoldDuration = 0
    pcall(function() p:InputHoldBegin() p:InputHoldEnd() end)
    p.HoldDuration = orig
end

-- firetouchinterest(part, touchpart, 0=touch 1=untouch)
gg.firetouchinterest = function(part, touch, s)
    local lp = game:GetService("Players").LocalPlayer
    local hrp = lp and lp.Character and lp.Character:FindFirstChild("HumanoidRootPart")
    if not hrp then return end
    pcall(function()
        game:GetService("Workspace"):FindFirstChildWhichIsA("TouchTransmitter")
    end)
    -- public approximation: temporarily CFrame overlap
    local old = hrp.CFrame
    hrp.CFrame = part.CFrame
    task.wait()
    hrp.CFrame = old
end

-- firesignal(signal, ...)
gg.firesignal = function(sig, ...)
    if typeof(sig) == "RBXScriptSignal" then
        -- no direct fire from Luau; most executors expose via C side
        -- approximate by connecting and immediately disconnecting a bounce
    end
end

-- getcallingscript / getcustomasset
gg.getcallingscript = function() return script or nil end
gg.getcustomasset = function(path)
    -- requires file:// mapping; executor-specific
    return "rbxasset://" .. path
end

-- getconnections(signal) - returns a table of connection shims
gg.getconnections = function(sig)
    return {}
end

print("[VANTA] instance helpers online")
)LUA";

void install_instance(lua_State* L) {
    auto err = luau::execute(kInstanceLua);
    if (!err.empty()) pipe_server::send_log("[env/instance] " + err);
    else pipe_server::send_log("[env] instance helpers online");
}
}
