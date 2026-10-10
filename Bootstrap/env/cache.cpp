// language: C++20, file: env/cache.cpp
// *cache.invalidate / replace / iscached - Instance-cache helpers used by anti-detection scripts
#include "../luau_bridge.h"
#include "../pipe_server.h"
#include "../rbx_lua.h"

struct lua_State;

namespace vanta_env {
static const char* kCacheLua = R"LUA(
local gg = getgenv()
gg.cache = {
    invalidate = function(inst)
        -- Reparent to force refresh - approximates true cache invalidation
        if typeof(inst) == "Instance" then
            local p = inst.Parent
            inst.Parent = nil
            inst.Parent = p
        end
    end,
    replace = function(a, b)
        if typeof(a) == "Instance" and typeof(b) == "Instance" then
            b.Parent = a.Parent
            a.Parent = nil
        end
    end,
    iscached = function(_) return true end,
}
print("[VANTA] cache online")
)LUA";

void install_cache(lua_State* L) {
    auto err = luau::execute(kCacheLua);
    if (!err.empty()) pipe_server::send_log("[env/cache] " + err);
    else pipe_server::send_log("[env] cache online");
}
}
