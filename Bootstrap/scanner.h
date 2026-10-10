#pragma once
#include <cstdint>
#include <string_view>
namespace scanner {
    uintptr_t module_base(const wchar_t* name);
    uintptr_t find_pattern(uintptr_t base, size_t size, std::string_view ida_pattern);
    // convenience: scan RobloxPlayerBeta.exe .text with "AA BB ? CC"
    uintptr_t scan(std::string_view pattern);
}
