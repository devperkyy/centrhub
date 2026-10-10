// language: C++20, file: phys_io.cpp
// *RTCore64 IOCTL interface. The IOCTL packet layout (from public analysis of the driver):
//   offset 0  : u32 reserved
//   offset 8  : u64 physical address
//   offset 16 : u32 size (1/2/4 byte width)
//   offset 24 : u32 value / out-buffer (read sinks here)
// Driver only exposes 1/2/4 byte access; larger transfers chunk through.
#include "phys_io.h"
#include <cstring>

static constexpr DWORD IOCTL_READ  = 0x80002048;
static constexpr DWORD IOCTL_WRITE = 0x8000204C;

#pragma pack(push, 1)
struct rtc_pkt {
    uint32_t reserved;
    uint32_t pad0;
    uint64_t pa;
    uint32_t size;
    uint32_t value;
};
#pragma pack(pop)
static_assert(sizeof(rtc_pkt) == 24, "pkt layout");

static bool do_io(HANDLE drv, DWORD ioctl, rtc_pkt& p) {
    DWORD ret = 0;
    return DeviceIoControl(drv, ioctl, &p, sizeof(p), &p, sizeof(p), &ret, nullptr);
}

bool phys::read(HANDLE drv, uint64_t pa, void* out, uint32_t size) {
    uint8_t* buf = static_cast<uint8_t*>(out);
    for (uint32_t off = 0; off < size;) {
        uint32_t chunk = (size - off >= 4) ? 4 : (size - off >= 2 ? 2 : 1);
        rtc_pkt p{}; p.pa = pa + off; p.size = chunk;
        if (!do_io(drv, IOCTL_READ, p)) return false;
        memcpy(buf + off, &p.value, chunk);
        off += chunk;
    }
    return true;
}

bool phys::write(HANDLE drv, uint64_t pa, const void* in, uint32_t size) {
    const uint8_t* buf = static_cast<const uint8_t*>(in);
    for (uint32_t off = 0; off < size;) {
        uint32_t chunk = (size - off >= 4) ? 4 : (size - off >= 2 ? 2 : 1);
        rtc_pkt p{}; p.pa = pa + off; p.size = chunk;
        memcpy(&p.value, buf + off, chunk);
        if (!do_io(drv, IOCTL_WRITE, p)) return false;
        off += chunk;
    }
    return true;
}
