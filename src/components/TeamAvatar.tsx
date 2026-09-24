// Manager.avatarUrl holds Sleeper's avatar *id* (synced straight from the
// user record), not a full URL.
export function sleeperAvatarUrl(sleeperAvatarId: string | null | undefined) {
  return sleeperAvatarId ? `https://sleepercdn.com/avatars/${sleeperAvatarId}` : null;
}

export function TeamAvatar({ avatarId }: { avatarId: string | null | undefined }) {
  const src = sleeperAvatarUrl(avatarId);
  return (
    <div className="w-8 h-8 shrink-0 rounded-full bg-cardHover border border-border overflow-hidden flex items-center justify-center text-faint text-[9px]">
      {src ? (
        // Sleeper avatar CDN is a fixed external host, so a plain
        // <img> is simpler than configuring next/image remotePatterns.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        "?"
      )}
    </div>
  );
}
