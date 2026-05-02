import type { BabyAvatarKey } from '@/src/types/domain';

export const editorialAssets = {
  babyAvatar:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCXi5ac4r61M-lpslhBuTfGHouuFTG6PZ_kPrPMmZXp8yv03Qjn-rPW625Dh_FeIP5hGog65qhMlmi19uaQe-MmP2IbUm8D8cvf9wjo_jiAj8hwIEG5piY0_hoogp_-OVIHIM8aEPgURyyIBJyetHi4c5-gVNMHxuw9w2csi46dxtDeT0nZs3UwUn94eEbsxS3Ic7HLbY58I2Ee4y8hMwN9WJW--JBrydwx1sRryxnLAMuqPcEcWz9rajUf0wnci8b43hmyD-l5l2c',
  trackerBaby:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBWsdaKcKzGqnaAJySTwgseFdPuURW0-E4CHMlntWC87wEnTvhprrfLgGDtAKP6rpc3Mg6dtUJ-HIXHBpMgdVnMN2Qrbj4bYamz0MYOPgqt2IDxExvK1K0LfomnXrcnapHx1LHirwIU12JvWblki5-rMmSQ7MpOtx8rk7aWTlUHF7z9PyRsOsGHFd2W5fhYVPqSQzMOQnGO9yFEF83AcZZiWAF69b7T2THwkPvJTvFTP49LAnXWcrLcP2FVRViSh76UhwKXugF7U3g',
  growthBaby:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAAXNCLng-B3F7ibxgI-4UzcuC9GTts42OyxpJ8E7lezq4QuIS-rurGwmqBQ9dJZeE48JvEZAyTdPCLhoV66GCl_4Z6uETfMfpQV-Lrx4ZAUVBERoB7adiZ7BaJiRTOkwq8dOcNbXCni5gbP32kMnCm0f47My--QcJ9bSWbZqxCDUbhLdRbMs22o3yKitWEQyY-E3eTP7KNmH4ZfA9XnbTln5-Us6oQ1IZDAspDlg3VZd7Pm9oITNsd0KZVOrk5gNgYac3KwAuPrrw',
  familyHero:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC8UFuCQlWQyt3Lq8GVbgmBw6tsE2gG3gSP7TxyyP1jztZdeDwP6WY18bfcudpaWDGc-aHif2zI-XL_f5gCxfpNlyFeh5CkK7OBcHkIO2ou9qJJ0YVEE9zcb4w3_9t1rFJ0YU4_5-znOCRZUd6oK6zZVWp5_3v9cDUJF0B619jt95DI6ZUEtoJnsKAGjT7mBvrhdSynmQe09rjrsy013ey-Y2PayHG6rGsddf_Ieb3zY-r6sEP3idOk0RWeQwPXKFqymqIslDUGBc8',
  childOne:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuApqsWk56a9zeSxL8UeZDNqbGAmkpb4yaMB1YGmzyRnuuGzG-350ClFb0wDHUswIlIVOrQHtaPkVthoI2Xe3SI68q6877GdrNeAA7mTpsUBe4K7ca82NWrYAlLI57o-E-umera1m7TiGR-1pvyJa1aBjYRzHj1oGD6C1su1GVZ4IBVcv0ZZFnBXsL-EDbVZ5JnRVovUE_992rGNFxy7hl8GSpw5ndvyrTy0JNOdjnzu9S7OdIp5yLALx6b6h6C3Lv-1x5z8VGtYdnQ',
  childTwo:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCPKE_heEXIFKNYf_o3J-otHfm69QPEeD-5y3CtmIIb54B_qcIh6ZGogLqgjRQXQmqkfU-jcKsxDAm9vbh9xDVcIWmxZYL_8JHChB3xep5fedQR8lOxHiIP81XcKA4kG9Sd-xdhx2imGrGCKun5eXznb1j-c0a52an3Lb1VrgrA4icYqE7CVKT8qKwAD1ql_vwDW12XmhO_2sawEl8khq0DyKCCxWGdM5wn1CF3BMl7_w7TWLJyKWRL4-oxhNZGnUbVmDZodVAI1uQ',
} as const;

export const babyAvatarOptions: BabyAvatarKey[] = ['babyAvatar', 'trackerBaby', 'growthBaby', 'childOne', 'childTwo'];

export function getBabyAvatarUri(avatarKey?: BabyAvatarKey | null) {
  if (avatarKey && avatarKey in editorialAssets) {
    return editorialAssets[avatarKey];
  }

  return editorialAssets.babyAvatar;
}
