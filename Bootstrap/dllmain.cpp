// language: C++20, file: dllmain.cpp
// Bootstrap DLL - runs inside Roblox process. Spins up pipe server, inits luau bridge.
#include <windows.h>
#include <thread>
#include "pipe_server.h"
#include "luau_bridge.h"
#include "environment.h"

static std::thread g_worker;

static DWORD WINAPI worker(LPVOID) {
    // give the loader a tick to settle
    Sleep(300);
    if (!luau::init()) { OutputDebugStringA("[VANTA] luau init failed\n"); return 1; }
    environment::install();
    pipe_server::run(L"vanta_pipe");
    return 0;
}

BOOL APIENTRY DllMain(HMODULE mod, DWORD reason, LPVOID) {
    if (reason == DLL_PROCESS_ATTACH) {
        DisableThreadLibraryCalls(mod);
        CreateThread(nullptr, 0, worker, nullptr, 0, nullptr);
    }
    return TRUE;
}
