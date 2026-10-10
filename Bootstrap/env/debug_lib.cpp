// language: C++20, file: env/debug_lib.cpp
// *debug.* family. Pushes a new `debug` table merging with Luau's existing one.
#include "../rbx_lua.h"
#include "../pipe_server.h"

struct lua_State;

// debug.getupvalue(f, n) ---------------------------------------------
static int d_getupvalue(lua_State* L) {
    int n = rl_tointeger(L, 2);
    const char* name = rl::getupvalue(L, 1, n);
    if (!name) rl::pushnil(L);
    return 1;
}
// debug.setupvalue(f, n, v) ------------------------------------------
static int d_setupvalue(lua_State* L) {
    int n = rl_tointeger(L, 2);
    rl::pushvalue(L, 3);
    const char* name = rl::setupvalue(L, 1, n);
    rl::pushboolean(L, name != nullptr);
    return 1;
}
// debug.getupvalues(f) -----------------------------------------------
static int d_getupvalues(lua_State* L) {
    rl::createtable(L, 0, 0);
    int i = 1;
    while (true) {
        const char* n = rl::getupvalue(L, 1, i);
        if (!n) break;
        rl::rawseti(L, -2, i++);
    }
    return 1;
}
// debug.getinfo(level_or_f, opts) ------------------------------------
static int d_getinfo(lua_State* L) {
    int level = rl::type(L,1) == RL_TNUMBER ? rl_tointeger(L,1) : 0;
    const char* opts = rl::type(L,2) == RL_TSTRING ? rl_tostring(L,2) : "sln";
    char ar[256] = {};
    if (!rl::getinfo(L, level, opts, ar)) { rl::pushnil(L); return 1; }
    // ar layout (Luau lua_Debug): we return a Luau table with likely fields.
    // Can't portably read ar struct; expose what Luau's lua_getinfo already pushed on stack.
    rl::createtable(L, 0, 8);
    // best-effort: lua_getinfo with 'f' already pushed func, 'n' name etc.
    // we leave the fields the C API set as stack returns; wrap into table here is incomplete
    return 1;
}
// debug.getconstants(f), setconstant - require proto walk, Luau exposes limited API
static int d_getconstants(lua_State* L) {
    // not available via public rl::; return empty table
    rl::createtable(L, 0, 0);
    return 1;
}
static int d_setconstant(lua_State* L) { return 0; }
// debug.getproto / getprotos - approximate: return self in a 1-elem table
static int d_getproto(lua_State* L)  { rl::createtable(L,0,0); rl::pushvalue(L,1); rl::rawseti(L,-2,1); return 1; }
static int d_getprotos(lua_State* L) { rl::createtable(L,0,0); rl::pushvalue(L,1); rl::rawseti(L,-2,1); return 1; }
// debug.getstack / setstack - stack frames; limited without lua_Debug walker
static int d_getstack(lua_State* L) { rl::pushnil(L); return 1; }
static int d_setstack(lua_State* L) { return 0; }

namespace vanta_env {
void install_debug(lua_State* L) {
    rl::pushvalue(L, RL_GLOBALSINDEX);
    rl::getfield(L, -1, "debug");
    if (rl::type(L, -1) != RL_TTABLE) {
        rl_pop(L, 1);
        rl::createtable(L, 0, 10);
    }
    #define BIND(name, f) rl_pushcclosure(L, f, "debug." #name); rl::setfield(L, -2, #name)
    BIND(getupvalue,  d_getupvalue);
    BIND(setupvalue,  d_setupvalue);
    BIND(getupvalues, d_getupvalues);
    BIND(getinfo,     d_getinfo);
    BIND(getconstants,d_getconstants);
    BIND(setconstant, d_setconstant);
    BIND(getproto,    d_getproto);
    BIND(getprotos,   d_getprotos);
    BIND(getstack,    d_getstack);
    BIND(setstack,    d_setstack);
    #undef BIND
    rl::setfield(L, -2, "debug");
    rl_pop(L, 1);
    pipe_server::send_log("[env] debug family online");
}
}
