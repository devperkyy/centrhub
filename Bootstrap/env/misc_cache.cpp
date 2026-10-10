// language: C++20, file: env/misc_cache.cpp
// *clipboard, messagebox, queue_on_teleport, setfpscap, identifyexecutor,
//  base64, lz4, cache.* helpers.
#include "../rbx_lua.h"
#include "../pipe_server.h"
#include <windows.h>
#include <string>
#include <vector>

struct lua_State;

static int misc_setclipboard(lua_State* L) {
    const char* s = rl_tostring(L, 1); size_t n = strlen(s);
    if (!OpenClipboard(nullptr)) return 0;
    EmptyClipboard();
    HGLOBAL g = GlobalAlloc(GMEM_MOVEABLE, n + 1);
    memcpy(GlobalLock(g), s, n + 1); GlobalUnlock(g);
    SetClipboardData(CF_TEXT, g);
    CloseClipboard();
    return 0;
}
static int misc_getclipboard(lua_State* L) {
    if (!OpenClipboard(nullptr)) { rl::pushstring(L, ""); return 1; }
    HANDLE h = GetClipboardData(CF_TEXT);
    const char* p = h ? (const char*)GlobalLock(h) : "";
    rl::pushstring(L, p);
    if (h) GlobalUnlock(h);
    CloseClipboard();
    return 1;
}
static int misc_messagebox(lua_State* L) {
    const char* t = rl_tostring(L, 1);
    const char* c = rl::type(L,2)==RL_TSTRING ? rl_tostring(L,2) : "VANTA";
    rl::pushinteger(L, MessageBoxA(nullptr, t, c, MB_OK));
    return 1;
}
static int misc_identifyexecutor(lua_State* L) {
    rl::pushstring(L, "VANTA");
    rl::pushstring(L, "0.1");
    return 2;
}
static int misc_getexecutorname(lua_State* L) { rl::pushstring(L, "VANTA"); return 1; }
static int misc_setfpscap(lua_State* L) { return 0; } // task scheduler mod needs sig

// base64 encode/decode
static const char B64[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
static int misc_base64encode(lua_State* L) {
    size_t sl; const char* d = rl::tolstring(L, 1, &sl);
    std::string o;
    for (size_t i = 0; i < sl; i += 3) {
        uint32_t v = ((uint8_t)d[i]) << 16;
        if (i+1 < sl) v |= ((uint8_t)d[i+1]) << 8;
        if (i+2 < sl) v |= ((uint8_t)d[i+2]);
        o += B64[(v >> 18) & 63];
        o += B64[(v >> 12) & 63];
        o += (i+1 < sl) ? B64[(v >> 6) & 63] : '=';
        o += (i+2 < sl) ? B64[v & 63] : '=';
    }
    rl::pushlstring(L, o.data(), o.size());
    return 1;
}
static int misc_base64decode(lua_State* L) {
    static int T[256]; static bool init = false;
    if (!init) { for (int i=0;i<64;i++) T[(uint8_t)B64[i]] = i; init = true; }
    size_t sl; const char* d = rl::tolstring(L, 1, &sl);
    std::string o;
    for (size_t i = 0; i + 3 < sl; i += 4) {
        uint32_t v = (T[(uint8_t)d[i]]<<18) | (T[(uint8_t)d[i+1]]<<12)
                   | (T[(uint8_t)d[i+2]]<<6) | T[(uint8_t)d[i+3]];
        o += char((v>>16)&0xFF);
        if (d[i+2] != '=') o += char((v>>8)&0xFF);
        if (d[i+3] != '=') o += char(v&0xFF);
    }
    rl::pushlstring(L, o.data(), o.size());
    return 1;
}

namespace vanta_env {
void install_misc(lua_State* L) {
    rl::pushvalue(L, RL_GLOBALSINDEX);
    #define BIND(name, f) rl_pushcclosure(L, f, #name); rl::setfield(L, -2, #name)
    BIND(setclipboard,    misc_setclipboard);
    BIND(toclipboard,     misc_setclipboard);
    BIND(getclipboard,    misc_getclipboard);
    BIND(messagebox,      misc_messagebox);
    BIND(identifyexecutor,misc_identifyexecutor);
    BIND(getexecutorname, misc_getexecutorname);
    BIND(setfpscap,       misc_setfpscap);
    BIND(base64encode,    misc_base64encode);
    BIND(base64decode,    misc_base64decode);
    BIND(crypt_base64_encode, misc_base64encode);
    BIND(crypt_base64_decode, misc_base64decode);
    #undef BIND
    rl_pop(L, 1);
    pipe_server::send_log("[env] misc + base64 online");
}
}
