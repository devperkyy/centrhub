// language: C++20, file: rbx_lua.cpp
// *resolver: scan RobloxPlayerBeta.exe for each Luau C API function and bind it.
// Signatures are PER CLIENT BUILD. See README "deriving signatures" for the method.
// Where a reliable sig doesn't exist, we xref a string the function references.
#include "rbx_lua.h"
#include "scanner.h"
#include "pipe_server.h"

namespace rl {
    // stack
    int  (*gettop)(lua_State*);
    void (*settop)(lua_State*, int);
    void (*pushvalue)(lua_State*, int);
    void (*remove)(lua_State*, int);
    void (*insert)(lua_State*, int);
    void (*replace)(lua_State*, int);
    int  (*checkstack)(lua_State*, int);
    // type
    int         (*type)(lua_State*, int);
    const char* (*typename_)(lua_State*, int);
    int         (*isnumber)(lua_State*, int);
    int         (*isstring)(lua_State*, int);
    int         (*iscfunction)(lua_State*, int);
    int         (*rawequal)(lua_State*, int, int);
    int         (*equal)(lua_State*, int, int);
    // read
    double       (*tonumberx)(lua_State*, int, int*);
    int          (*toboolean)(lua_State*, int);
    const char*  (*tolstring)(lua_State*, int, size_t*);
    void*        (*tothread)(lua_State*, int);
    void*        (*touserdata)(lua_State*, int);
    const void*  (*topointer)(lua_State*, int);
    // push
    void (*pushnil)(lua_State*);
    void (*pushnumber)(lua_State*, double);
    void (*pushinteger)(lua_State*, int);
    void (*pushlstring)(lua_State*, const char*, size_t);
    void (*pushstring)(lua_State*, const char*);
    void (*pushcclosurek)(lua_State*, lua_CFunction, const char*, int, lua_CFunction);
    void (*pushboolean)(lua_State*, int);
    int  (*pushthread)(lua_State*);
    void (*pushlightuserdata)(lua_State*, void*);
    // tables
    void (*createtable)(lua_State*, int, int);
    void (*getfield)(lua_State*, int, const char*);
    void (*setfield)(lua_State*, int, const char*);
    void (*rawget)(lua_State*, int);
    void (*rawset)(lua_State*, int);
    void (*rawgeti)(lua_State*, int, int);
    void (*rawseti)(lua_State*, int, int);
    int  (*next)(lua_State*, int);
    // mt
    int  (*getmetatable)(lua_State*, int);
    int  (*setmetatable)(lua_State*, int);
    void (*setreadonly)(lua_State*, int, int);
    int  (*getreadonly)(lua_State*, int);
    // call
    void (*call)(lua_State*, int, int);
    int  (*pcall)(lua_State*, int, int, int);
    // extras
    void*       (*newuserdata)(lua_State*, size_t);
    const char* (*getupvalue)(lua_State*, int, int);
    const char* (*setupvalue)(lua_State*, int, int);
    void*       (*ref)(lua_State*, int);
    void        (*unref)(lua_State*, int);
    int         (*getinfo)(lua_State*, int, const char*, void*);
    int         (*namecallatom)(lua_State*, int*);
    void        (*error)(lua_State*);
    // roblox
    lua_State* (*r_getstate)(int);
    int        (*r_luau_load)(lua_State*, const char*, const char*, size_t, int);
    int        (*r_task_defer)(lua_State*);
}

// ------ signatures (placeholders - refresh per build; see README) ------
// Grouping: Luau xrefs string "value", "stack overflow", "attempt to call a %s value", etc.
struct sig_entry { void** slot; const char* name; const char* pat; };

static sig_entry G_SIGS[] = {
    // --- stack ---
    { (void**)&rl::gettop,       "lua_gettop",       "48 8B 41 ? 48 2B 41 ? 48 C1 F8 ? C3" },
    { (void**)&rl::settop,       "lua_settop",       "40 53 48 83 EC ? 48 8B D9 85 D2 78" },
    { (void**)&rl::pushvalue,    "lua_pushvalue",    "40 53 48 83 EC ? 48 8B D9 E8 ? ? ? ? 48 8B 4B" },
    { (void**)&rl::remove,       "lua_remove",       "40 55 48 83 EC ? 48 8B E9 E8 ? ? ? ?" },
    { (void**)&rl::insert,       "lua_insert",       "40 55 48 83 EC ? 48 8B E9 E8" },
    { (void**)&rl::replace,      "lua_replace",      "48 89 5C 24 ? 48 89 74 24 ? 57 48 83 EC ? 48 8B F1" },
    { (void**)&rl::checkstack,   "lua_checkstack",   "48 89 5C 24 ? 57 48 83 EC ? 8B DA 48 8B F9 85 D2" },
    // --- type ---
    { (void**)&rl::type,         "lua_type",         "40 53 48 83 EC ? 48 8B D9 E8 ? ? ? ? 48 3D" },
    { (void**)&rl::typename_,    "lua_typename",     "48 83 EC ? 83 FA ? 7C ? 48 8D 05" },
    { (void**)&rl::isnumber,     "lua_isnumber",     "48 83 EC ? E8 ? ? ? ? 83 F8 ? 74 ? 83 F8 ? 74" },
    { (void**)&rl::isstring,     "lua_isstring",     "48 83 EC ? E8 ? ? ? ? 83 F8 ? 74 ? 83 F8 ? 75" },
    { (void**)&rl::iscfunction,  "lua_iscfunction",  "40 53 48 83 EC ? 48 8B D9 E8 ? ? ? ? 48 83 F8 ? 75" },
    { (void**)&rl::rawequal,     "lua_rawequal",     "48 89 5C 24 ? 48 89 74 24 ? 57 48 83 EC ? 41 8B F0 8B DA 48 8B F9" },
    { (void**)&rl::equal,        "lua_equal",        "48 89 5C 24 ? 48 89 6C 24 ? 48 89 74 24 ? 57 48 83 EC ? 41 8B E8" },
    // --- read ---
    { (void**)&rl::tonumberx,    "lua_tonumberx",    "48 89 5C 24 ? 48 89 74 24 ? 57 48 83 EC ? 49 8B F8 8B DA" },
    { (void**)&rl::toboolean,    "lua_toboolean",    "48 83 EC ? E8 ? ? ? ? 83 F8 ? 75 ? 33" },
    { (void**)&rl::tolstring,    "lua_tolstring",    "48 89 5C 24 ? 48 89 6C 24 ? 48 89 74 24 ? 57 48 83 EC ? 4C 8B C2" },
    { (void**)&rl::tothread,     "lua_tothread",     "48 83 EC ? E8 ? ? ? ? 83 F8 ? 75 ? 48 8B 00" },
    { (void**)&rl::touserdata,   "lua_touserdata",   "48 83 EC ? E8 ? ? ? ? 83 F8 ? 75 ? 48 8B 00 C3" },
    { (void**)&rl::topointer,    "lua_topointer",    "40 53 48 83 EC ? 48 8B D9 E8 ? ? ? ? 48 83 F8 ? 72" },
    // --- push ---
    { (void**)&rl::pushnil,          "lua_pushnil",         "C7 41 ? FF FF FF FF 48 8B 41 ? 48 83 C0 ? 48 89 41" },
    { (void**)&rl::pushnumber,       "lua_pushnumber",      "F2 0F 11 41 ? 48 8B 41 ? 48 83 C0 ? C7 40" },
    { (void**)&rl::pushinteger,      "lua_pushinteger",     "F3 0F 2A C2 F2 0F 11 41" },
    { (void**)&rl::pushlstring,      "lua_pushlstring",     "48 89 5C 24 ? 48 89 74 24 ? 57 48 83 EC ? 49 8B F9 4C 8B C2" },
    { (void**)&rl::pushstring,       "lua_pushstring",      "48 85 D2 74 ? 48 89 5C 24 ? 57 48 83 EC ? 48 8B DA" },
    { (void**)&rl::pushcclosurek,    "lua_pushcclosurek",   "48 89 5C 24 ? 48 89 74 24 ? 48 89 7C 24 ? 55 41 56 41 57" },
    { (void**)&rl::pushboolean,      "lua_pushboolean",     "48 8B 41 ? 85 D2 0F 95 C2 89 50 ? C7" },
    { (void**)&rl::pushthread,       "lua_pushthread",      "48 8B 41 ? 48 89 08 C7 40 ? 08 00 00 00" },
    { (void**)&rl::pushlightuserdata,"lua_pushlightuserdata","48 8B 41 ? 48 89 10 C7 40 ? 02 00 00 00" },
    // --- tables ---
    { (void**)&rl::createtable,  "lua_createtable",  "48 89 5C 24 ? 48 89 74 24 ? 57 48 83 EC ? 41 8B D9" },
    { (void**)&rl::getfield,     "lua_getfield",     "48 89 5C 24 ? 48 89 74 24 ? 48 89 7C 24 ? 41 56 48 83 EC ? 4D 8B F0" },
    { (void**)&rl::setfield,     "lua_setfield",     "48 89 5C 24 ? 48 89 74 24 ? 48 89 7C 24 ? 41 56 48 83 EC ? 4D 8B F0 48 8B FA" },
    { (void**)&rl::rawget,       "lua_rawget",       "48 89 5C 24 ? 48 89 6C 24 ? 48 89 74 24 ? 57 48 83 EC ? 48 8B F9 8B DA 48 8B" },
    { (void**)&rl::rawset,       "lua_rawset",       "48 89 5C 24 ? 48 89 74 24 ? 57 48 83 EC ? 48 8B F9 8B DA 48 8B D1" },
    { (void**)&rl::rawgeti,      "lua_rawgeti",      "48 89 5C 24 ? 48 89 6C 24 ? 48 89 74 24 ? 57 48 83 EC ? 41 8B F8 8B DA" },
    { (void**)&rl::rawseti,      "lua_rawseti",      "48 89 5C 24 ? 48 89 74 24 ? 57 48 83 EC ? 41 8B F8 8B DA 48 8B F1" },
    { (void**)&rl::next,         "lua_next",         "48 89 5C 24 ? 48 89 6C 24 ? 48 89 74 24 ? 57 48 83 EC ? 48 8B F9 8B DA E8" },
    // --- mt ---
    { (void**)&rl::getmetatable, "lua_getmetatable", "48 89 5C 24 ? 48 89 74 24 ? 57 48 83 EC ? 48 8B F9 8B DA E8 ? ? ? ? 48" },
    { (void**)&rl::setmetatable, "lua_setmetatable", "48 89 5C 24 ? 48 89 74 24 ? 57 48 83 EC ? 48 8B F9 8B DA E8 ? ? ? ? 48 83 F8" },
    { (void**)&rl::setreadonly,  "lua_setreadonly",  "40 53 48 83 EC ? 48 8B D9 E8 ? ? ? ? 44 8A 44" },
    { (void**)&rl::getreadonly,  "lua_getreadonly",  "48 83 EC ? E8 ? ? ? ? 0F B6 40 ? C3" },
    // --- call ---
    { (void**)&rl::call,  "lua_call",  "48 89 5C 24 ? 48 89 6C 24 ? 48 89 74 24 ? 57 48 83 EC ? 41 8B F0 8B EA" },
    { (void**)&rl::pcall, "lua_pcall", "48 89 5C 24 ? 48 89 6C 24 ? 48 89 74 24 ? 48 89 7C 24 ? 41 56 48 83 EC ? 44 8B F1" },
    // --- extras ---
    { (void**)&rl::newuserdata,  "lua_newuserdata",  "48 89 5C 24 ? 48 89 6C 24 ? 48 89 74 24 ? 57 48 83 EC ? 48 8B DA 48 8B F9 33" },
    { (void**)&rl::getupvalue,   "lua_getupvalue",   "48 89 5C 24 ? 48 89 74 24 ? 57 48 83 EC ? 41 8B F8 8B DA 48 8B F1 E8" },
    { (void**)&rl::setupvalue,   "lua_setupvalue",   "48 89 5C 24 ? 48 89 74 24 ? 57 48 83 EC ? 41 8B F8 8B DA 48 8B F1 48" },
    { (void**)&rl::ref,          "lua_ref",          "40 53 48 83 EC ? 48 8B D9 83 FA ? 75 ? 48 8B 41" },
    { (void**)&rl::unref,        "lua_unref",        "48 89 5C 24 ? 57 48 83 EC ? 48 8B F9 85 D2 78" },
    { (void**)&rl::getinfo,      "lua_getinfo",      "48 89 5C 24 ? 48 89 6C 24 ? 48 89 74 24 ? 57 41 54 41 55 41 56 41 57 48 83 EC ? 48 8B E9" },
    { (void**)&rl::namecallatom, "lua_namecallatom", "48 8B 81 ? ? ? ? 48 85 C0 74 ? 66 8B 10" },
    { (void**)&rl::error,        "lua_error",        "48 83 EC ? 48 8B 41 ? 48 2B 41 ? 48 C1 F8" },
    // --- roblox internals ---
    { (void**)&rl::r_getstate,   "rbx_getstate",     "48 89 5C 24 ? 57 48 83 EC ? 8B DA" },
    { (void**)&rl::r_luau_load,  "rbx_luau_load",    "48 89 5C 24 ? 48 89 74 24 ? 57 48 83 EC ? 49 8B F9" },
    { (void**)&rl::r_task_defer, "rbx_task_defer",   "48 89 5C 24 ? 48 89 74 24 ? 48 89 7C 24 ? 55 48 8B EC" },
};

namespace rl { bool getstate_critical_present(); }
bool rl::init() {
    int ok = 0, miss = 0;
    for (auto& e : G_SIGS) {
        uintptr_t a = scanner::scan(e.pat);
        if (a) { *e.slot = (void*)a; ok++; }
        else { pipe_server::send_log(std::string("[rbx_lua] miss: ") + e.name); miss++; }
    }
    pipe_server::send_log("[rbx_lua] resolved " + std::to_string(ok) + "/" + std::to_string(ok + miss));
    // we tolerate up to ~5 misses on non-essentials; abort if critical ones missed
    return rl::getstate_critical_present();
}

// Minimal check — these HAVE to be present for the executor to boot.
namespace rl { bool getstate_critical_present() {
    return pushcclosurek && settop && getfield && setfield && call && pcall
        && pushvalue && getmetatable && setmetatable && setreadonly
        && tolstring && pushlstring && createtable && r_getstate && r_luau_load;
}}
