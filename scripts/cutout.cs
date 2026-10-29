using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class AssetTool {
  public static int Main(string[] args) {
    if (args.Length < 4) {
      Console.Error.WriteLine("usage: cutout <pet-src> <pet-dest> <icon-src> <icon-dest>");
      return 2;
    }
    var info = Cutout(args[0], args[1]);
    Icon(args[2], args[3]);
    Console.WriteLine(info);
    return 0;
  }

  static string Cutout(string src, string dest) {
    using (var raw = new Bitmap(src))
    using (var bmp = new Bitmap(raw.Width, raw.Height, PixelFormat.Format32bppArgb)) {
      using (var g = Graphics.FromImage(bmp)) {
        g.DrawImage(raw, 0, 0, raw.Width, raw.Height);
      }
      int w = bmp.Width, h = bmp.Height;
      var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
      int stride = data.Stride;
      int bytes = stride * h;
      byte[] buf = new byte[bytes];
      Marshal.Copy(data.Scan0, buf, 0, bytes);

      long br = 0, bgc = 0, bb = 0, n = 0;
      for (int x = 0; x < w; x += 3) {
        Add(buf, stride, x, 0, ref br, ref bgc, ref bb, ref n);
        Add(buf, stride, x, h - 1, ref br, ref bgc, ref bb, ref n);
      }
      for (int y = 0; y < h; y += 3) {
        Add(buf, stride, 0, y, ref br, ref bgc, ref bb, ref n);
        Add(buf, stride, w - 1, y, ref br, ref bgc, ref bb, ref n);
      }
      int r0 = (int)(br / n), g0 = (int)(bgc / n), b0 = (int)(bb / n);

      bool[] gone = new bool[w * h];
      var q = new Queue<int>();
      for (int x = 0; x < w; x++) {
        EnqueueIf(buf, stride, w, h, gone, q, x, 0, r0, g0, b0, 75);
        EnqueueIf(buf, stride, w, h, gone, q, x, h - 1, r0, g0, b0, 75);
      }
      for (int y = 0; y < h; y++) {
        EnqueueIf(buf, stride, w, h, gone, q, 0, y, r0, g0, b0, 75);
        EnqueueIf(buf, stride, w, h, gone, q, w - 1, y, r0, g0, b0, 75);
      }
      while (q.Count > 0) {
        int p = q.Dequeue();
        int x = p % w;
        int y = p / w;
        buf[y * stride + x * 4 + 3] = 0;
        EnqueueIf(buf, stride, w, h, gone, q, x + 1, y, r0, g0, b0, 75);
        EnqueueIf(buf, stride, w, h, gone, q, x - 1, y, r0, g0, b0, 75);
        EnqueueIf(buf, stride, w, h, gone, q, x, y + 1, r0, g0, b0, 75);
        EnqueueIf(buf, stride, w, h, gone, q, x, y - 1, r0, g0, b0, 75);
      }

      for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
          int i = y * stride + x * 4;
          if (buf[i + 3] == 0) continue;
          if (Dist(buf[i + 2], buf[i + 1], buf[i], r0, g0, b0) < 42) buf[i + 3] = 0;
        }
      }

      for (int pass = 0; pass < 2; pass++) {
        byte[] alpha = new byte[w * h];
        for (int y = 0; y < h; y++) {
          for (int x = 0; x < w; x++) alpha[y * w + x] = buf[y * stride + x * 4 + 3];
        }
        for (int y = 1; y < h - 1; y++) {
          for (int x = 1; x < w - 1; x++) {
            int p = y * w + x;
            if (alpha[p] == 0) continue;
            bool near = alpha[p - 1] == 0 || alpha[p + 1] == 0 || alpha[p - w] == 0 || alpha[p + w] == 0;
            if (!near) continue;
            int i = y * stride + x * 4;
            int dist = Dist(buf[i + 2], buf[i + 1], buf[i], r0, g0, b0);
            if (dist < 110) {
              int a = (dist - 42) * 255 / 68;
              if (a < 0) a = 0;
              if (a > 255) a = 255;
              if (a < buf[i + 3]) buf[i + 3] = (byte)a;
            }
          }
        }
      }

      int minX = w, minY = h, maxX = 0, maxY = 0, opaque = 0;
      for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
          if (buf[y * stride + x * 4 + 3] > 16) {
            opaque++;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      Marshal.Copy(buf, 0, data.Scan0, bytes);
      bmp.UnlockBits(data);
      if (opaque == 0) throw new Exception("cutout removed everything");
      int pad = 12;
      int left = Math.Max(0, minX - pad);
      int top = Math.Max(0, minY - pad);
      int cw = Math.Min(w - left, maxX - minX + 1 + pad * 2);
      int ch = Math.Min(h - top, maxY - minY + 1 + pad * 2);
      using (var cropped = bmp.Clone(new Rectangle(left, top, cw, ch), PixelFormat.Format32bppArgb)) {
        cropped.Save(dest, ImageFormat.Png);
      }
      double ratio = (double)opaque / (w * h);
      return "bg=" + r0 + "," + g0 + "," + b0 + " opaque=" + opaque + " ratio=" + ratio.ToString("0.000") + " crop=" + cw + "x" + ch;
    }
  }

  static void Icon(string src, string dest) {
    using (var raw = new Bitmap(src))
    using (var bmp = new Bitmap(512, 512, PixelFormat.Format32bppArgb))
    using (var g = Graphics.FromImage(bmp)) {
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      g.PixelOffsetMode = PixelOffsetMode.HighQuality;
      g.SmoothingMode = SmoothingMode.HighQuality;
      g.Clear(Color.FromArgb(255, 18, 22, 20));
      g.DrawImage(raw, 0, 0, 512, 512);
      bmp.Save(dest, ImageFormat.Png);
    }
  }

  static void Add(byte[] buf, int stride, int x, int y, ref long br, ref long bgc, ref long bb, ref long n) {
    int i = y * stride + x * 4;
    bb += buf[i];
    bgc += buf[i + 1];
    br += buf[i + 2];
    n++;
  }

  static int Dist(int r, int g, int b, int r0, int g0, int b0) {
    int dr = r - r0, dg = g - g0, db = b - b0;
    return (int)Math.Sqrt(dr * dr + dg * dg + db * db);
  }

  static void EnqueueIf(byte[] buf, int stride, int w, int h, bool[] gone, Queue<int> q, int x, int y, int r0, int g0, int b0, int maxDist) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    int p = y * w + x;
    if (gone[p]) return;
    int i = y * stride + x * 4;
    if (Dist(buf[i + 2], buf[i + 1], buf[i], r0, g0, b0) > maxDist) return;
    gone[p] = true;
    q.Enqueue(p);
  }
}
