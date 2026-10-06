"""透明边缘的确定性回归；不修改母版和图集。"""
import importlib.util
import unittest
from pathlib import Path
from PIL import Image
spec=importlib.util.spec_from_file_location('packer',Path(__file__).with_name('pack-east-boss-animation.py'))
packer=importlib.util.module_from_spec(spec);spec.loader.exec_module(packer)

class AlphaTests(unittest.TestCase):
    def test_premultiply_once(self):
        im=Image.new('RGBA',(3,1));im.putdata([(240,120,60,0),(240,120,60,128),(240,120,60,255)])
        out=packer.premultiply(im)
        self.assertEqual(list(out.getdata()),[(0,0,0,0),(120,60,30,128),(240,120,60,255)])
        self.assertEqual(im.getpixel((1,0)),(240,120,60,128))

    def test_bleed_preserves_alpha_and_whole_colours(self):
        im=Image.new('RGBA',(11,11));im.putpixel((3,5),(220,20,10,255));im.putpixel((7,5),(10,180,30,128))
        out=packer.bleed_edges(im)
        self.assertEqual(out.getchannel('A').tobytes(),im.getchannel('A').tobytes())
        self.assertEqual(out.getpixel((7,5)),im.getpixel((7,5)))
        self.assertTrue(all(rgb in {(0,0,0),(220,20,10),(10,180,30)} for rgb in out.convert('RGB').getdata()))

    def test_compression_does_not_emit_bright_transparent_plate(self):
        im=Image.new('RGBA',(16,16),(255,255,255,0));im.paste((200,160,80,255),(4,4,12,12))
        data,decoded=packer.ktx(im)
        self.assertEqual(len(data),68+256)
        self.assertEqual(decoded.getpixel((0,0)),(0,0,0,0))
        self.assertEqual(decoded.getpixel((8,8))[3],255)

if __name__=='__main__':unittest.main()
