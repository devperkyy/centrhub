// language: C++20, file: luau_bridge.cpp
// *bridge into Roblox's embedded Luau VM.
//   1. getstate(identity) resolved by signature scan from live client
//   2. source compiled to bytecode via in-tree Luau::compile
//   3. bytecode handed to Roblox's luau_load (signature-scanned) then task_defer'd
//
// Signatures below are placeholders - see README "Deriving signatures" to refresh.

#include "luau_bridge.h"
#include "scanner.h"
#include "pipe_server.h"

#include <windows.h>
#include <string>

#include "Luau/Compiler.h"
#include "Luau/BytecodeBuilder.h"

struct lua_State; // opaque to this TU - we only pass pointer through to Roblox symbols

namespace rbx {
    using getstate_t   = lua_State* (*)(int);
    using luau_load_t  = int (*)(lua_State*, const char*, const char*, size_t, int);
    using pcall_t      = int (*)(lua_State*, int, int, int);
    using task_defer_t = int (*)(lua_State*);

    getstate_t   getstate   = nullptr;
    luau_load_t  luau_load  = nullptr;
    pcall_t      pcall      = nullptr;
    task_defer_t task_defer = nullptr;
}

static lua_State* g_L = nullptr;

namespace luau {

bool init() {
    // placeholders - re-derive per client build
    constexpr const char* SIG_GETSTATE   = "48 89 5C 24 ? 57 48 83 EC 20 8B DA";
    constexpr const char* SIG_LUAU_LOAD  = "48 89 5C 24 ? 48 89 74 24 ? 57 48 83 EC 40 49 8B F9";
    constexpr const char* SIG_PCALL      = "40 53 48 83 EC 30 48 8B D9 83 FA FE";
    constexpr const char* SIG_TASK_DEFER = "48 89 5C 24 ? 48 89 74 24 ? 48 89 7C 24 ? 55 48 8B EC";

    rbx::getstate   = (rbx::getstate_t)   scanner::scan(SIG_GETSTATE);
    rbx::luau_load  = (rbx::luau_load_t)  scanner::scan(SIG_LUAU_LOAD);
    rbx::pcall      = (rbx::pcall_t)      scanner::scan(SIG_PCALL);
    rbx::task_defer = (rbx::task_defer_t) scanner::scan(SIG_TASK_DEFER);

    if (!rbx::getstate || !rbx::luau_load || !rbx::pcall) {
        pipe_server::send_log("[luau] signature miss - refresh sigs in luau_bridge.cpp (see README)");
        return false;
    }
    // identity 8 = highest executor context on current builds
    g_L = rbx::getstate(8);
    return g_L != nullptr;
}

std::string execute(const std::string& src) {
    if (!g_L) return "no lua_State";
    try {
        Luau::CompileOptions opts;
        opts.optimizationLevel = 2;
        opts.debugLevel = 1;
        std::string bc = Luau::compile(src, opts);
        if (bc.empty() || bc[0] == 0) return "compile fail: " + bc;

        int load = rbx::luau_load(g_L, "@VANTA", bc.data(), bc.size(), 0);
        if (load != 0) return "load fail";

        if (rbx::task_defer) rbx::task_defer(g_L);
        else {
            int r = rbx::pcall(g_L, 0, 0, 0);
            if (r != 0) return "runtime error";
        }
        return "";
    } catch (const std::exception& e) { return std::string("exc: ") + e.what(); }
}

void* L() { return g_L; }

} // namespace luau
