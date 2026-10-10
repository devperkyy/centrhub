// language: C++20, file: pipe_server.cpp
// Hosts the named pipe end inside the target. protocol: u32 len LE + utf8 body.
// payload[0]: 'S' script, 'L' log, 'K' kill.
#include "pipe_server.h"
#include "luau_bridge.h"
#include <windows.h>
#include <mutex>
#include <string>
#include <vector>

namespace {
    HANDLE g_pipe = INVALID_HANDLE_VALUE;
    std::mutex g_mtx;

    bool write_all(const void* b, size_t n) {
        DWORD w = 0;
        return WriteFile(g_pipe, b, (DWORD)n, &w, nullptr) && w == n;
    }
    bool read_all(void* b, size_t n) {
        DWORD r = 0; size_t total = 0;
        while (total < n) {
            if (!ReadFile(g_pipe, (char*)b + total, (DWORD)(n - total), &r, nullptr) || r == 0) return false;
            total += r;
        }
        return true;
    }
}

namespace pipe_server {

void send_log(const std::string& line) {
    std::lock_guard<std::mutex> lk(g_mtx);
    if (g_pipe == INVALID_HANDLE_VALUE) return;
    uint32_t len = (uint32_t)(line.size() + 1);
    write_all(&len, 4);
    const char tag = 'L';
    write_all(&tag, 1);
    write_all(line.data(), line.size());
}

void run(const wchar_t* name) {
    std::wstring full = L"\\\\.\\pipe\\"; full += name;

    for (;;) {
        g_pipe = CreateNamedPipeW(
            full.c_str(),
            PIPE_ACCESS_DUPLEX,
            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
            1, 1 << 16, 1 << 16, 0, nullptr);
        if (g_pipe == INVALID_HANDLE_VALUE) { Sleep(500); continue; }

        if (!ConnectNamedPipe(g_pipe, nullptr) && GetLastError() != ERROR_PIPE_CONNECTED) {
            CloseHandle(g_pipe); g_pipe = INVALID_HANDLE_VALUE; continue;
        }

        send_log("[VANTA] bootstrap online");
        send_log("[VANTA] luau state resolved");

        for (;;) {
            uint32_t len = 0;
            if (!read_all(&len, 4) || len == 0 || len > (1u << 20)) break;
            std::vector<char> buf(len);
            if (!read_all(buf.data(), len)) break;
            char tag = buf[0];
            std::string body(buf.data() + 1, len - 1);

            if (tag == 'S') {
                send_log(std::string("[>] exec ") + std::to_string(body.size()) + " chars");
                auto err = luau::execute(body);
                if (!err.empty()) send_log("[err] " + err);
            } else if (tag == 'K') {
                break;
            }
        }

        DisconnectNamedPipe(g_pipe);
        CloseHandle(g_pipe);
        g_pipe = INVALID_HANDLE_VALUE;
    }
}

} // namespace pipe_server
