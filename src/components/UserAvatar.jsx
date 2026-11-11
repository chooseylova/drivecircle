export default function UserAvatar({ user, name, avatarUrl, size = "md" }) {
  const displayName = name || user?.full_name || user?.email || "?";
  const photo = avatarUrl || user?.avatar_url;
  const initial = displayName[0].toUpperCase();

  const sizes = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-14 h-14 text-xl",
    xl: "w-20 h-20 text-3xl",
  };

  return (
    <div className={`${sizes[size]} rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0`}>
      {photo ? (
        <img src={photo} alt={displayName} className="w-full h-full object-cover" />
      ) : (
        <span className="font-bold text-primary">{initial}</span>
      )}
    </div>
  );
}