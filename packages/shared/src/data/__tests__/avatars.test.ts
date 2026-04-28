import {
  AVATAR_OPTIONS,
  AvatarLOD,
  DEFAULT_AVATAR_URL,
  getAllAvatarLODUrls,
  getAvatarUrlForLOD,
  normalizeAvatarAssetUrl,
} from "../avatars";

describe("avatar definitions", () => {
  it("does not advertise missing LOD files", () => {
    for (const avatar of AVATAR_OPTIONS) {
      expect(avatar.lod1Url).toBeUndefined();
      expect(avatar.lod2Url).toBeUndefined();
    }
  });

  it("falls back to the base VRM for all LOD requests", () => {
    for (const avatar of AVATAR_OPTIONS) {
      expect(getAvatarUrlForLOD(avatar, AvatarLOD.LOD0)).toBe(avatar.url);
      expect(getAvatarUrlForLOD(avatar, AvatarLOD.LOD1)).toBe(avatar.url);
      expect(getAvatarUrlForLOD(avatar, AvatarLOD.LOD2)).toBe(avatar.url);
      expect(getAllAvatarLODUrls(avatar)).toEqual([avatar.url]);
    }
  });

  it("normalizes stale avatar LOD URLs across supported forms", () => {
    expect(
      normalizeAvatarAssetUrl("asset://avatars/avatar-male-01_lod1.vrm"),
    ).toBe("asset://avatars/avatar-male-01.vrm");
    expect(
      normalizeAvatarAssetUrl("avatars/avatar-female-02_lod2.vrm?cache=1"),
    ).toBe("asset://avatars/avatar-female-02.vrm?cache=1");
    expect(
      normalizeAvatarAssetUrl("/avatars/avatar-female-01_lod1.vrm#preview"),
    ).toBe("asset://avatars/avatar-female-01.vrm#preview");
    expect(normalizeAvatarAssetUrl("ws-avatar_lod2.vrm")).toBe(
      "asset://avatars/avatar-male-01.vrm",
    );
    expect(
      normalizeAvatarAssetUrl(
        "https://assets.example.com/avatars/avatar-male-02_lod1.vrm",
      ),
    ).toBe("https://assets.example.com/avatars/avatar-male-02.vrm");
    expect(normalizeAvatarAssetUrl("")).toBe(DEFAULT_AVATAR_URL);
  });
});
