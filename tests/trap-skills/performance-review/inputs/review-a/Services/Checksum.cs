using System.Runtime.InteropServices;

namespace Orders.Api.Services;

public static class Checksum
{
    [DllImport("libz", EntryPoint = "crc32")]
    private static extern ulong Crc32(ulong crc, byte[] buf, uint len);

    public static uint Compute(byte[] data)
    {
        ulong crc = 0;
        var one = new byte[1];
        for (var i = 0; i < data.Length; i++)
        {
            one[0] = data[i];
            crc = Crc32(crc, one, 1);
        }
        return (uint)crc;
    }
}
