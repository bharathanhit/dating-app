import React from 'react';
import { Badge, Avatar } from '@mui/material';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * OnlineStatusIndicator - Shows an avatar with online status badge
 * @param {string} userId - The user ID to show status for
 * @param {string} src - Avatar image source
 * @param {string} alt - Avatar alt text
 * @param {Object} avatarProps - Additional props for Avatar component
 * @param {boolean} showRipple - Whether to show animated ripple effect (default: true)
 */
const OnlineStatusIndicator = ({
    userId,
    src,
    alt = "User avatar",
    avatarProps = {},
    showRipple = true
}) => {
    const status = useOnlineStatus(userId);
    const isOnline = status?.online || false;

    return (
        <Badge
            overlap="circular"
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            variant="dot"
            sx={{
                "& .MuiBadge-badge": {
                    backgroundColor: isOnline ? "#44b700" : "transparent",
                    color: isOnline ? "#44b700" : "transparent",
                    boxShadow: `0 0 0 2px ${isOnline ? "#fff" : "transparent"}`,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    "&::after": isOnline && showRipple
                        ? {
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            borderRadius: "50%",
                            animation: "ripple 1.2s infinite ease-in-out",
                            border: "1px solid currentColor",
                            content: '""',
                        }
                        : {},
                },
                "@keyframes ripple": {
                    "0%": {
                        transform: "scale(.8)",
                        opacity: 1,
                    },
                    "100%": {
                        transform: "scale(2.4)",
                        opacity: 0,
                    },
                },
            }}
        >
            <Avatar src={src} alt={alt} {...avatarProps} />
        </Badge>
    );
};

export default OnlineStatusIndicator;
