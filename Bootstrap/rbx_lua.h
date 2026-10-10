// language: C++20, file: rbx_lua.h
// *Function pointers into Roblox's embedded Luau VM, resolved per-build via sig scan.
// We NEVER call our in-tree Luau VM functions against Roblox's lua_State - Roblox forks
// Luau, so struct layouts can shift. Our in-tree Luau is used ONLY for compile().
#pragma once
#include <cstddef>
#include <cstdint>

struct lua_State;
typedef int (*lua_CFunction)(lua_State*);

// pseudo-indices
#define RL_GLOBALSINDEX (-10002)
#define RL_REGISTRYINDEX (-10000)
#define RL_ENVIRONINDEX (-10001)

// types
#define RL_TNIL 0
#define RL_TBOOLEAN 1
#define RL_TLIGHTUSERDATA 2
#define RL_TNUMBER 3
#define RL_TVECTOR 4
#define RL_TSTRING 5
#define RL_TTABLE 6
#define RL_TFUNCTION 7
#define RL_TUSERDATA 8
#define RL_TTHREAD 9
#define RL_TBUFFER 10

namespace rl {
    // --- stack / state ---
    extern int  (*gettop)(lua_State*);
    extern void (*settop)(lua_State*, int);
    extern void (*pushvalue)(lua_State*, int);
    extern void (*remove)(lua_State*, int);
    extern void (*insert)(lua_State*, int);
    extern void (*replace)(lua_State*, int);
    extern int  (*checkstack)(lua_State*, int);

    // --- type queries ---
    extern int         (*type)(lua_State*, int);
    extern const char* (*typename_)(lua_State*, int);
    extern int         (*isnumber)(lua_State*, int);
    extern int         (*isstring)(lua_State*, int);
    extern int         (*iscfunction)(lua_State*, int);
    extern int         (*rawequal)(lua_State*, int, int);
    extern int         (*equal)(lua_State*, int, int);

    // --- read ---
    extern double       (*tonumberx)(lua_State*, int, int*);
    extern int          (*toboolean)(lua_State*, int);
    extern const char*  (*tolstring)(lua_State*, int, size_t*);
    extern void*        (*tothread)(lua_State*, int);
    extern void*        (*touserdata)(lua_State*, int);
    extern const void*  (*topointer)(lua_State*, int);

    // --- push ---
    extern void (*pushnil)(lua_State*);
    extern void (*pushnumber)(lua_State*, double);
    extern void (*pushinteger)(lua_State*, int);
    extern void (*pushlstring)(lua_State*, const char*, size_t);
    extern void (*pushstring)(lua_State*, const char*);
    extern void (*pushcclosurek)(lua_State*, lua_CFunction, const char* debugname, int nup, lua_CFunction cont);
    extern void (*pushboolean)(lua_State*, int);
    extern int  (*pushthread)(lua_State*);
    extern void (*pushlightuserdata)(lua_State*, void*);

    // --- tables ---
    extern void (*createtable)(lua_State*, int narr, int nrec);
    extern void (*getfield)(lua_State*, int idx, const char* k);
    extern void (*setfield)(lua_State*, int idx, const char* k);
    extern void (*rawget)(lua_State*, int);
    extern void (*rawset)(lua_State*, int);
    extern void (*rawgeti)(lua_State*, int, int);
    extern void (*rawseti)(lua_State*, int, int);
    extern int  (*next)(lua_State*, int);

    // --- metatables (Luau-specific extensions) ---
    extern int  (*getmetatable)(lua_State*, int);
    extern int  (*setmetatable)(lua_State*, int);
    extern void (*setreadonly)(lua_State*, int, int);
    extern int  (*getreadonly)(lua_State*, int);

    // --- call / pcall ---
    extern void (*call)(lua_State*, int nargs, int nresults);
    extern int  (*pcall)(lua_State*, int nargs, int nresults, int errfunc);

    // --- Luau extras ---
    extern void*       (*newuserdata)(lua_State*, size_t);
    extern const char* (*getupvalue)(lua_State*, int funcindex, int n);
    extern const char* (*setupvalue)(lua_State*, int funcindex, int n);
    extern void*       (*ref)(lua_State*, int);
    extern void        (*unref)(lua_State*, int);
    extern int         (*getinfo)(lua_State*, int level, const char* what, void* ar); // Luau lua_Debug
    extern int         (*namecallatom)(lua_State*, int* atom);                        // getnamecallmethod core
    extern void        (*error)(lua_State*);

    // --- Roblox executor glue (resolved from client, not Luau proper) ---
    extern lua_State*  (*r_getstate)(int identity);
    extern int         (*r_luau_load)(lua_State*, const char* chunkname, const char* bc, size_t sz, int env);
    extern int         (*r_task_defer)(lua_State*);

    bool init();  // resolve all signatures; returns false on first miss (logged)
}

// convenience inlines mirroring the lauxlib macros
inline int   rl_tointeger(lua_State* L, int i) { int ok; return (int)rl::tonumberx(L, i, &ok); }
inline double rl_tonumber(lua_State* L, int i) { int ok; return rl::tonumberx(L, i, &ok); }
inline const char* rl_tostring(lua_State* L, int i) { return rl::tolstring(L, i, nullptr); }
inline void rl_pop(lua_State* L, int n) { rl::settop(L, -(n) - 1); }
inline void rl_pushcclosure(lua_State* L, lua_CFunction f, const char* name = nullptr) {
    rl::pushcclosurek(L, f, name, 0, nullptr);
}
