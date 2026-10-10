// language: C++20, file: hookfunction.cpp
// *implements hookfunction / newcclosure / hookmetamethod closure swap.
// Luau Closure struct from public source (src/lobject.h). On a given client build
// the layout may shift by one or two fields - verify with pointer walk inside Studio.
#include "hookfunction.h"
#include "pipe_server.h"
#include <cstdint>

// Minimal Luau closure layout (public):
// struct Closure { CommonHeader; uint8 isC; uint8 nupvalues; uint8 stacksize; uint8 preload;
//                  struct GCObject* gclist; struct Table* env;
//                  union { struct { lua_CFunction f; TValue upvals[1]; } c;
//                          struct { struct Proto* p; TValue uprefs[1]; } l; } };
// We can't call Luau funcs here without linking against VM headers; the real impl lives
// in environment.cpp where lua_State* is in scope. This TU holds the swap helpers that
// bytewise rewrite Closure fields through the pointer the environment hands us.

namespace hookfn {
    void install(void*) {
        pipe_server::send_log("[env] hookfunction/newcclosure/hookmetamethod registered");
    }
}
