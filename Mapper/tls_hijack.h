#pragma once
#include <windows.h>
#include <cstdint>
namespace tls_hijack {
    // Hijack a TLS callback slot of a known target-process module (ntdll preferred)
    // so our DllMain runs on the next thread transition. Original slot restored by
    // our stub after one call.
    bool arm(HANDLE drv, uint64_t cr3, HANDLE target,
             uint64_t our_dll_base, uint64_t our_dllmain_rva);
}
