#pragma once
#include <windows.h>
#include <cstdint>
void* manual_map(HANDLE h, const uint8_t* dll_bytes, size_t sz);
