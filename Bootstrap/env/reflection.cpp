// language: C++20, file: env/reflection.cpp
// *getreg, getgc, getinstances, getnilinstances, getloadedmodules.
// Luau-side implementations where safer; C-side for getreg which is trivial.
#include "../rbx_lua.h"
#include "../luau_bridge.h"
#include "../pipe_server.h"

struct lua_State;

static int ref_getreg(lua_State* L) {
    rl::pushvalue(L, RL_REGISTRYINDEX);
    return 1;
}

namespace vanta_env {

static const char* kReflLua = R"LUA(
local gg = getgenv()

-- getgc(includeTables) - returns a table of GC objects. Full GC walk requires VM internals;
-- approximation here enumerates the loaded Instance tree + registry entries.
gg.getgc = function(includeTables)
    local out = {}
    for _, v in ipairs(game:GetDescendants()) do out[#out+1] = v end
    if includeTables then
        for _, t in pairs(_G) do if type(t) == "table" then out[#out+1] = t end end
    end
    return out
end

-- getinstances: every instance currently in DataModel
gg.getinstances = function()
    return game:GetDescendants()
end
-- getnilinstances: Instances whose parent chain ends in nil (not in DataModel). 
-- Requires debug.getregistry walk — approximate with empty table.
gg.getnilinstances = function()
    return {}
end
-- getloadedmodules: approximation via Instance tree ModuleScripts
gg.getloadedmodules = function()
    local out = {}
    for _, d in ipairs(game:GetDescendants()) do
        if d:IsA("ModuleScript") then out[#out+1] = d end
    end
    return out
end
-- getscripts: all LocalScript + Script in DataModel
gg.getscripts = function()
    local out = {}
    for _, d in ipairs(game:GetDescendants()) do
        if d:IsA("LocalScript") or d:IsA("Script") or d:IsA("ModuleScript") then out[#out+1] = d end
    end
    return out
end
-- getrunningscripts: approximation same as getscripts filtered by Enabled
gg.getrunningscripts = function()
    local out = {}
    for _, d in ipairs(game:GetDescendants()) do
        if (d:IsA("LocalScript") or d:IsA("Script")) and d.Enabled then out[#out+1] = d end
    end
    return out
end

print("[VANTA] reflection online")
)LUA";

void install_reflection(lua_State* L) {
    rl::pushvalue(L, RL_GLOBALSINDEX);
    rl_pushcclosure(L, ref_getreg, "getreg"); rl::setfield(L, -2, "getreg");
    rl_pop(L, 1);
    auto err = luau::execute(kReflLua);
    if (!err.empty()) pipe_server::send_log("[env/reflection] " + err);
    else pipe_server::send_log("[env] reflection online");
}
}
