#pragma once
#include <windows.h>
namespace rtcore {
    bool install(const wchar_t* driver_path);   // CreateService + StartService
    HANDLE open();                              // open \\.\RTCore64
    void stop();                                // StopService + DeleteService
}
