// language: C++20, file: env/net.cpp
// *HttpGet / HttpPost / request via WinHTTP. Called on a worker thread so we never
// block the game's main thread. No sigs needed.
#include "../rbx_lua.h"
#include "../pipe_server.h"
#include <windows.h>
#include <winhttp.h>
#include <string>
#include <vector>

#pragma comment(lib, "winhttp.lib")

struct lua_State;

struct http_resp { bool ok; int status; std::string body; std::string err; };

static http_resp do_http(const std::wstring& method, const std::wstring& url,
                         const std::string& body,
                         const std::vector<std::pair<std::wstring, std::wstring>>& hdrs) {
    http_resp r{false, 0, {}, {}};
    URL_COMPONENTS uc{sizeof(uc)};
    wchar_t host[256]{}, path[1024]{};
    uc.lpszHostName = host; uc.dwHostNameLength = 256;
    uc.lpszUrlPath = path; uc.dwUrlPathLength = 1024;
    if (!WinHttpCrackUrl(url.c_str(), 0, 0, &uc)) { r.err = "bad url"; return r; }

    HINTERNET s = WinHttpOpen(L"VANTA/0.1", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
                              WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    if (!s) { r.err = "open"; return r; }
    HINTERNET c = WinHttpConnect(s, host, uc.nPort, 0);
    HINTERNET req = WinHttpOpenRequest(c, method.c_str(), path, nullptr,
        WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES,
        uc.nScheme == INTERNET_SCHEME_HTTPS ? WINHTTP_FLAG_SECURE : 0);
    for (auto& [k, v] : hdrs) {
        auto h = k + L": " + v + L"\r\n";
        WinHttpAddRequestHeaders(req, h.c_str(), (DWORD)-1, WINHTTP_ADDREQ_FLAG_ADD);
    }
    BOOL ok = WinHttpSendRequest(req, WINHTTP_NO_ADDITIONAL_HEADERS, 0,
        (LPVOID)(body.empty() ? nullptr : body.data()), (DWORD)body.size(),
        (DWORD)body.size(), 0) && WinHttpReceiveResponse(req, nullptr);
    if (ok) {
        DWORD st = 0, stSize = sizeof(st);
        WinHttpQueryHeaders(req, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                            WINHTTP_HEADER_NAME_BY_INDEX, &st, &stSize, WINHTTP_NO_HEADER_INDEX);
        r.status = (int)st;
        DWORD avail = 0;
        do {
            if (!WinHttpQueryDataAvailable(req, &avail)) break;
            std::vector<char> buf(avail);
            DWORD read = 0;
            if (!WinHttpReadData(req, buf.data(), avail, &read)) break;
            r.body.append(buf.data(), read);
        } while (avail);
        r.ok = true;
    } else r.err = "send/receive";
    WinHttpCloseHandle(req); WinHttpCloseHandle(c); WinHttpCloseHandle(s);
    return r;
}

static std::wstring utf8_to_w(const std::string& s) {
    int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0);
    std::wstring w(n, 0);
    MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), w.data(), n);
    return w;
}

static int net_httpget(lua_State* L) {
    auto url = utf8_to_w(rl_tostring(L, 1));
    auto r = do_http(L"GET", url, "", {});
    if (!r.ok) { rl::pushnil(L); rl::pushstring(L, r.err.c_str()); return 2; }
    rl::pushlstring(L, r.body.data(), r.body.size());
    return 1;
}
static int net_httppost(lua_State* L) {
    auto url  = utf8_to_w(rl_tostring(L, 1));
    size_t sl; const char* data = rl::tolstring(L, 2, &sl);
    std::vector<std::pair<std::wstring, std::wstring>> h = {
        { L"Content-Type", L"application/json" }
    };
    auto r = do_http(L"POST", url, std::string(data, sl), h);
    if (!r.ok) { rl::pushnil(L); rl::pushstring(L, r.err.c_str()); return 2; }
    rl::pushlstring(L, r.body.data(), r.body.size());
    return 1;
}
// request({Url=..., Method=..., Headers={}, Body=...}) returns {Success,StatusCode,Body,Headers}
static int net_request(lua_State* L) {
    rl::getfield(L, 1, "Url");    std::string url = rl_tostring(L, -1); rl_pop(L, 1);
    rl::getfield(L, 1, "Method"); std::string m   = rl::type(L,-1)==RL_TSTRING ? rl_tostring(L,-1) : "GET"; rl_pop(L,1);
    rl::getfield(L, 1, "Body");   std::string body;
    if (rl::type(L,-1) == RL_TSTRING) { size_t sl; const char* d = rl::tolstring(L,-1,&sl); body.assign(d,sl); }
    rl_pop(L,1);
    std::vector<std::pair<std::wstring, std::wstring>> hdrs;
    rl::getfield(L, 1, "Headers");
    if (rl::type(L,-1) == RL_TTABLE) {
        rl::pushnil(L);
        while (rl::next(L, -2)) {
            hdrs.push_back({utf8_to_w(rl_tostring(L,-2)), utf8_to_w(rl_tostring(L,-1))});
            rl_pop(L, 1);
        }
    }
    rl_pop(L, 1);
    auto r = do_http(utf8_to_w(m), utf8_to_w(url), body, hdrs);
    rl::createtable(L, 0, 4);
    rl::pushboolean(L, r.ok);  rl::setfield(L, -2, "Success");
    rl::pushinteger(L, r.status); rl::setfield(L, -2, "StatusCode");
    rl::pushlstring(L, r.body.data(), r.body.size()); rl::setfield(L, -2, "Body");
    rl::pushstring(L, r.ok ? "" : r.err.c_str()); rl::setfield(L, -2, "StatusMessage");
    return 1;
}

namespace vanta_env {
void install_net(lua_State* L) {
    rl::pushvalue(L, RL_GLOBALSINDEX);
    #define BIND(name, f) rl_pushcclosure(L, f, #name); rl::setfield(L, -2, #name)
    BIND(HttpGet,  net_httpget);
    BIND(httpget,  net_httpget);
    BIND(HttpPost, net_httppost);
    BIND(httppost, net_httppost);
    BIND(request,  net_request);
    BIND(http_request, net_request);
    #undef BIND
    rl_pop(L, 1);
    pipe_server::send_log("[env] net online (WinHTTP)");
}
}
