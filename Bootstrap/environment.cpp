// language: C++20, file: environment.cpp
// *orchestrator: all env groups install in order so later ones can rely on earlier.
#include "environment.h"
#include "luau_bridge.h"
#include "hookfunction.h"
#include "pipe_server.h"
#include "rbx_lua.h"

struct lua_State;

namespace vanta_env {
    void install_metatable_closures(lua_State*);
    void install_debug(lua_State*);
    void install_fs(lua_State*);
    void install_net(lua_State*);
    void install_instance(lua_State*);
    void install_drawing(lua_State*);
    void install_misc(lua_State*);
    void install_reflection(lua_State*);
    void install_cache(lua_State*);
}

namespace environment {

void install() {
    hookfn::install(luau::L());

    if (!rl::init()) {
        pipe_server::send_log("[env] rl::init critical miss - executor API disabled");
        return;
    }
    auto L = (lua_State*)luau::L();
    if (!L) { pipe_server::send_log("[env] no lua_State"); return; }

    // order matters: metatable + closure first (loadstring lives there),
    // then everything that may rely on loadstring or getgenv.
    vanta_env::install_metatable_closures(L);
    vanta_env::install_debug(L);
    vanta_env::install_fs(L);
    vanta_env::install_net(L);
    vanta_env::install_misc(L);
    vanta_env::install_reflection(L);
    vanta_env::install_instance(L);
    vanta_env::install_cache(L);
    vanta_env::install_drawing(L);

    pipe_server::send_log("[env] all groups installed - targeting ~85-90% UNC");
}

} // namespace environment
