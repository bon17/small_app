"""앞장 포스터에 '주의' 칸 자리를 만들어요. 크기는 1024x1536 그대로.
종이봉투+구호를 함께 S배로 줄이고(크림 배경에서 오려 내서), 그 아래(쿠폰·나무·안내 줄)는 위로 올려요.
생긴 빈칸(기간 띠 위)은 눈밭으로 채워요. 출력: 이미지, 그리고 빈칸 위치(y0 y1)."""
import sys
from PIL import Image, ImageChops, ImageFilter, ImageDraw
SRC, OUT = sys.argv[1], sys.argv[2]
S = float(sys.argv[3]) if len(sys.argv) > 3 else 0.72
im = Image.open(SRC).convert('RGB')
W, H = im.size
px = im.load()
TOP, BAGEND, END = 488, 836, 990   # 제목 아래 | 봉투 끝(양옆 눈송이 구분용) | 구호 아래
B1, C0 = 1335, 1370                # 작은 안내 줄 아래 | 기간 띠 위 눈밭

def bg_of(y):
    xs = [px[x, y] for x in list(range(0, 40, 2)) + list(range(984, 1024, 2))]
    xs.sort(key=sum); return xs[len(xs) // 2]

# 줄을 넘나드는 오른쪽 눈송이(905, 990)는 떼어 두었다가 쿠폰과 함께 옮겨요.
FL = (878, 962, 930, 1016)
flake = im.crop(FL)
work = im.copy(); wd = work.load()
for y in range(FL[1], FL[3]):
    c = px[FL[0] - 6, y]
    for x in range(FL[0], FL[2]): wd[x, y] = c

def cutout(part, y0):
    bg = Image.new('RGB', (1, part.height))
    for i in range(part.height): bg.putpixel((0, i), bg_of(y0 + i))
    diff = ImageChops.difference(part, bg.resize(part.size, Image.NEAREST)).convert('L')
    return diff.point(lambda v: 0 if v < 7 else (255 if v > 24 else int((v - 7) * 255 / 17))).filter(ImageFilter.GaussianBlur(0.7))

out = Image.new('RGB', (W, H))
out.paste(im.crop((0, 0, W, TOP)), (0, 0))

n = END - TOP
nh = round(n * S)
saved = n - nh
col = Image.new('RGB', (1, n))
for i in range(n): col.putpixel((0, i), bg_of(TOP + i))
region = col.resize((1, nh), Image.BILINEAR).resize((W, nh), Image.NEAREST)

layer = work.crop((0, TOP, W, END))
a = cutout(layer, TOP)
d = ImageDraw.Draw(a)  # 봉투 높이의 양옆 눈송이는 따로 붙여요
d.rectangle((0, 0, 184, BAGEND - TOP), fill=0); d.rectangle((846, 0, W, BAGEND - TOP), fill=0)
lw = round(W * S)
region.paste(layer.resize((lw, nh), Image.LANCZOS), ((W - lw) // 2, 0), a.resize((lw, nh), Image.LANCZOS))
for (x, y, r) in [(150, 565, 34), (920, 530, 36), (880, 690, 30), (110, 790, 34), (81, 650, 12), (976, 624, 14), (949, 761, 13), (40, 491, 9)]:
    p = im.crop((x - r, y - r, x + r, y + r))
    region.paste(p, (x - r, round((y - TOP) * S) - r), cutout(p, y - r))
out.paste(region, (0, TOP))

y = TOP + nh
band = work.crop((0, END, W, B1))
out.paste(band, (0, y))
out.paste(flake, (FL[0], FL[1] - saved), cutout(flake, FL[1]))
y += band.height
gap = C0 - y
out.paste(im.crop((0, B1, W, C0)).resize((W, gap), Image.BICUBIC), (0, y))
out.paste(im.crop((0, C0, W, H)), (0, C0))
out.save(OUT)
print(y, C0)
