// language: C++20, file: env/fs.cpp
// *Filesystem rooted at %APPDATA%\VANTA\workspace\. No sigs needed - pure Win32.
#include "../rbx_lua.h"
#include "../pipe_server.h"
#include <windows.h>
#include <shlobj.h>
#include <string>
#include <filesystem>
#include <fstream>
#include <sstream>

#pragma comment(lib, "shell32.lib")

struct lua_State;

namespace fs = std::filesystem;

static fs::path workspace_root() {
    wchar_t appdata[MAX_PATH];
    SHGetFolderPathW(nullptr, CSIDL_APPDATA, nullptr, 0, appdata);
    fs::path p = fs::path(appdata) / L"VANTA" / L"workspace";
    std::error_code ec; fs::create_directories(p, ec);
    return p;
}

// path-traversal guard: resolve against root, ensure canonical path is still inside
static fs::path safe(const std::string& user) {
    fs::path root = workspace_root();
    fs::path raw  = root / user;
    std::error_code ec;
    fs::path abs = fs::weakly_canonical(raw, ec);
    if (ec) return {};
    auto rs = fs::weakly_canonical(root).string();
    auto as = abs.string();
    if (as.rfind(rs, 0) != 0) return {};
    return abs;
}

static int fs_readfile(lua_State* L) {
    auto p = safe(rl_tostring(L, 1));
    if (p.empty()) { rl::pushnil(L); rl::pushstring(L, "bad path"); return 2; }
    std::ifstream f(p, std::ios::binary);
    if (!f) { rl::pushnil(L); rl::pushstring(L, "not found"); return 2; }
    std::stringstream ss; ss << f.rdbuf();
    auto s = ss.str();
    rl::pushlstring(L, s.data(), s.size());
    return 1;
}
static int fs_writefile(lua_State* L) {
    auto p = safe(rl_tostring(L, 1));
    if (p.empty()) return 0;
    fs::create_directories(p.parent_path());
    size_t sl; const char* data = rl::tolstring(L, 2, &sl);
    std::ofstream f(p, std::ios::binary | std::ios::trunc);
    if (!f) return 0;
    f.write(data, sl);
    return 0;
}
static int fs_appendfile(lua_State* L) {
    auto p = safe(rl_tostring(L, 1));
    if (p.empty()) return 0;
    size_t sl; const char* data = rl::tolstring(L, 2, &sl);
    std::ofstream f(p, std::ios::binary | std::ios::app);
    if (!f) return 0;
    f.write(data, sl);
    return 0;
}
static int fs_isfile(lua_State* L) {
    auto p = safe(rl_tostring(L, 1));
    rl::pushboolean(L, !p.empty() && fs::is_regular_file(p));
    return 1;
}
static int fs_isfolder(lua_State* L) {
    auto p = safe(rl_tostring(L, 1));
    rl::pushboolean(L, !p.empty() && fs::is_directory(p));
    return 1;
}
static int fs_makefolder(lua_State* L) {
    auto p = safe(rl_tostring(L, 1));
    if (!p.empty()) fs::create_directories(p);
    return 0;
}
static int fs_listfiles(lua_State* L) {
    auto p = safe(rl_tostring(L, 1));
    rl::createtable(L, 0, 0);
    if (p.empty() || !fs::is_directory(p)) return 1;
    int i = 1;
    for (auto& e : fs::directory_iterator(p)) {
        auto rel = fs::relative(e.path(), workspace_root()).string();
        rl::pushstring(L, rel.c_str());
        rl::rawseti(L, -2, i++);
    }
    return 1;
}
static int fs_delfile(lua_State* L) {
    auto p = safe(rl_tostring(L, 1));
    if (!p.empty()) { std::error_code ec; fs::remove(p, ec); }
    return 0;
}
static int fs_delfolder(lua_State* L) {
    auto p = safe(rl_tostring(L, 1));
    if (!p.empty()) { std::error_code ec; fs::remove_all(p, ec); }
    return 0;
}

namespace vanta_env {
void install_fs(lua_State* L) {
    rl::pushvalue(L, RL_GLOBALSINDEX);
    #define BIND(name, f) rl_pushcclosure(L, f, #name); rl::setfield(L, -2, #name)
    BIND(readfile,    fs_readfile);
    BIND(writefile,   fs_writefile);
    BIND(appendfile,  fs_appendfile);
    BIND(isfile,      fs_isfile);
    BIND(isfolder,    fs_isfolder);
    BIND(makefolder,  fs_makefolder);
    BIND(listfiles,   fs_listfiles);
    BIND(delfile,     fs_delfile);
    BIND(delfolder,   fs_delfolder);
    #undef BIND
    rl_pop(L, 1);
    pipe_server::send_log("[env] filesystem online @ %APPDATA%\\VANTA\\workspace");
}
}
