 import { Box, IconButton, Typography } from "@mui/material";
import { Home, Favorite, Person, ChatBubble, Chat } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Footer = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "70px",
        background: "linear-gradient(180deg, #4B0082 0%, #2E0057 100%)", // dark purple gradient
        borderTopLeftRadius: "25px",
        borderTopRightRadius: "25px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-evenly",
        zIndex: 1000,
        boxShadow: "0 -4px 15px rgba(0,0,0,0.25)",
      }}
    >
      {/* Left icons */}
      <IconButton onClick={() => navigate("/")} sx={{ color: "white" }}>
        <Home fontSize="medium" />
      </IconButton>

      <IconButton onClick={() => navigate("/likes")} sx={{ color: "white" }}>
        <Favorite fontSize="medium" />
      </IconButton>

      {/* Center Floating Chat + Button */}
      <Box
        sx={{
          position: "absolute",
          bottom: "25px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "70px",
          height: "70px",
          background: "linear-gradient(145deg, #7F00FF, #E100FF)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
          cursor: "pointer",
          transition: "0.2s ease-in-out",
          "&:hover": {
            transform: "translateX(-50%) scale(1.08)",
          },
        }}
        // Leave this for future feature (random connect)
        onClick={() => {/* future: navigate to random connect page */}}
      >
        {/* Chat icon */}
        <ChatBubble
          sx={{ color: "white", fontSize: "27px", position: "relative" }}
        />

        {/* Plus symbol overlay */}
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

      {/* Right icons */}
      <IconButton onClick={() => navigate("/messages")} sx={{ color: "white" }}>
        <Chat fontSize="medium" />
      </IconButton>

      <IconButton onClick={() => navigate("/profile")} sx={{ color: "white" }}>
        <Person fontSize="medium" />
      </IconButton>
    </Box>
  );
};

export default Footer;