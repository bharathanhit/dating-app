import { Box, IconButton, Typography } from "@mui/material";
import { Home, Favorite, Person, ChatBubble, Chat } from "@mui/icons-material";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getRandomUser } from "../services/userService";
import { useState, useEffect } from "react";
import { Badge } from "@mui/material";

const Footer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, user, likeCount } = useAuth();
  const [isLoadingRandom, setIsLoadingRandom] = useState(false);

  const isActive = (path) => location.pathname === path;

  // Handle random chat button click
  const handleRandomChat = async () => {
    if (!user?.uid || isLoadingRandom) return;

    setIsLoadingRandom(true);
    try {
      const randomUser = await getRandomUser(user.uid);

      if (randomUser) {
        // Navigate to messages with the random user's UID
        navigate(`/messages?uid=${randomUser.uid}&random=true`);
      } else {
        console.log('No online users available for random chat');
        // Could show a toast/snackbar here: "No users are currently online. Try again later!"
      }
    } catch (error) {
      console.error('Error starting random chat:', error);
    } finally {
      setIsLoadingRandom(false);
    }
  };

  // Dimensions
  const footerHeight = 80;
  const topEdgeHeight = 20;
  const barHeight = footerHeight - topEdgeHeight; // 60px

  // Button dimensions (Old Style)
  const buttonSize = 70;
  const buttonRadius = buttonSize / 2;
  const gap = 8;
  const cutoutRadius = buttonRadius + gap;
  const centerWidth = cutoutRadius * 2 + 40;

  const svgCenterX = centerWidth / 2;
  const svgTopY = topEdgeHeight;

  const arcStartX = svgCenterX - cutoutRadius;
  const arcEndX = svgCenterX + cutoutRadius;

  // Smoothing parameters
  const smoothing = 12; // Corner radius
  const yStart = svgTopY + smoothing;
  // Calculate x point on the circle at yStart
  // x = cx +/- sqrt(r^2 - (y - cy)^2). cy is svgTopY.
  // y - cy = smoothing.
  const halfChord = Math.sqrt(cutoutRadius * cutoutRadius - smoothing * smoothing);
  const xCircleStart = svgCenterX - halfChord;
  const xCircleEnd = svgCenterX + halfChord;

  // Path: Valley cutout with rounded corners
  // M 0,top -> L (start-smoothing),top 
  // Q start,top xCircleStart,yStart (Curve into hole)
  // A ... (Main arc)
  // Q end,top (end+smoothing),top (Curve out) -> No, symmetric to entry
  // Q end,top (line_start_on_right) ? No.
  // Entry: Line to (arcStartX - smoothing), top. Q (arcStartX), top -> (xCircleStart), yStart.
  // Exit: from (xCircleEnd), yStart -> Q (arcEndX), top -> (arcEndX + smoothing), top.

  const pathData = `
    M 0,${svgTopY} 
    L ${arcStartX - smoothing},${svgTopY} 
    Q ${arcStartX},${svgTopY} ${xCircleStart},${yStart}
    A ${cutoutRadius},${cutoutRadius} 0 0,0 ${xCircleEnd},${yStart}
    Q ${arcEndX},${svgTopY} ${arcEndX + smoothing},${svgTopY}
    L ${centerWidth},${svgTopY} 
    L ${centerWidth},${footerHeight} 
    L 0,${footerHeight} 
    Z
  `;

  return (
    <Box
      id="app-footer"
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: `${footerHeight}px`,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        zIndex: 1000,
        pointerEvents: "none",
        filter: 'drop-shadow(0px -4px 15px rgba(0,0,0,0.25))',
      }}
    >
      {/* Responsive Background Layer */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          pointerEvents: 'auto',
        }}
      >
        {/* Left Block */}
        <Box
          sx={{
            flex: 1,
            height: `${barHeight}px`,
            background: 'linear-gradient(to bottom, #4B0082, #2E0057)',
            marginRight: '-1px', // Fix vertical line gap
            zIndex: 1,
          }}
        />

        {/* Center SVG Block */}
        <Box
          sx={{
            width: `${centerWidth}px`,
            height: '100%',
            position: 'relative',
            zIndex: 2, // Ensure center sits on top
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${centerWidth} ${footerHeight}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="centerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#4B0082" />
                <stop offset="100%" stopColor="#2E0057" />
              </linearGradient>
              {/* Curve path for text */}
              <path id="curvePath" d={`M ${arcStartX},${svgTopY} A ${cutoutRadius},${cutoutRadius} 0 0,0 ${arcEndX},${svgTopY}`} />
            </defs>

            <path d={pathData} fill="url(#centerGradient)" />

            {/* Curved Text */}
            <text
              fontSize="13"
              fill="#ffffff"
              fontWeight="bold"
              fontFamily="cursive"
              letterSpacing="1"
              textAnchor="middle"
            >
              <textPath href="#curvePath" startOffset="50%" side="left">
                Random Chat
              </textPath>
            </text>
          </svg>
        </Box>

        {/* Right Block */}
        <Box
          sx={{
            flex: 1,
            height: `${barHeight}px`,
            background: 'linear-gradient(to bottom, #4B0082, #2E0057)',
            marginLeft: '-1px', // Fix vertical line gap
            zIndex: 1,
          }}
        />
      </Box>

      {/* Navigation Items Overlay */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: `${barHeight}px`,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          pointerEvents: 'auto',
          pb: 1,
          zIndex: 3, // Ensure icons appear above background blocks
        }}
      >
        <IconButton onClick={() => navigate("/")} sx={{ color: "white" }}>
          <Home fontSize="medium" />
        </IconButton>

        <IconButton onClick={() => navigate("/likes", { state: { tab: 1 } })} sx={{ color: "white" }}>
          <Badge badgeContent={likeCount} color="error">
            <Favorite fontSize="medium" />
          </Badge>
        </IconButton>

        {/* Spacer for Center Button */}
        <Box sx={{ width: `${centerWidth}px` }} />

        <IconButton onClick={() => navigate("/messages")} sx={{ color: "white" }}>
          <Chat fontSize="medium" />
        </IconButton>

        <IconButton onClick={() => navigate("/profile")} sx={{ color: "white" }}>
          <Person fontSize="medium" />
        </IconButton>
      </Box>

      {/* Center Floating Chat Button (Old Style) - Now triggers random chat with online users */}
      <Box
        sx={{
          position: "absolute",
          bottom: "25px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "70px",
          height: "70px",
          background: isLoadingRandom
            ? "linear-gradient(145deg, #999, #666)"
            : "linear-gradient(145deg, #7F00FF, #E100FF)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
          cursor: isLoadingRandom ? "wait" : "pointer",
          pointerEvents: "auto",
          zIndex: 1001,
          transition: "0.2s ease-in-out",
          "&:hover": {
            transform: isLoadingRandom ? "translateX(-50%)" : "translateX(-50%) scale(1.05)",
          },
        }}
        onClick={handleRandomChat}
      >
        <ChatBubble sx={{ color: "white", fontSize: "27px", position: "relative" }} />
        <Typography
          sx={{
            position: "absolute",
            bottom: "18px",
            right: "18px",
            color: "white",
            fontWeight: "bold",
            fontSize: "22px",
            backgroundColor: "#7F00FF",
            borderRadius: "50%",
            width: "22px",
            height: "22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 5px rgba(255,255,255,0.6)",
          }}
        >
          +
        </Typography>
      </Box>
    </Box>
  );
};

export default Footer;