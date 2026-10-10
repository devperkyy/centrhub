#pragma once
#include <windows.h>
HANDLE open_target(DWORD pid);
uintptr_t find_module(HANDLE h, const wchar_t* name);
