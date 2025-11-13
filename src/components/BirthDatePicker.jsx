import { useState, useRef, useEffect } from 'react';
import { Box, Typography, Button, FormLabel } from '@mui/material';
import { motion } from 'framer-motion';

export const BirthDatePicker = ({ value, onChange }) => {
  const [day, setDay] = useState(value ? value.getDate() : 1);
  const [month, setMonth] = useState(value ? value.getMonth() : 0);
  const [year, setYear] = useState(value ? value.getFullYear() : 2000);
  const [showPicker, setShowPicker] = useState(false);

  const dayScrollRef = useRef(null);
  const monthScrollRef = useRef(null);
  const yearScrollRef = useRef(null);

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 80 }, (_, i) => currentYear - 18 - i);

  const handleDateSelect = () => {
    const newDate = new Date(year, month, day);
    onChange(newDate);
    setShowPicker(false);
  };

  const scrollToItem = (ref, index, itemHeight = 40) => {
    if (ref.current) {
      const scrollTop = index * itemHeight - (ref.current.clientHeight / 2 - itemHeight / 2);
      ref.current.scrollTop = scrollTop;
    }
  };

  useEffect(() => {
    if (showPicker) {
      setTimeout(() => {
        scrollToItem(dayScrollRef, day - 1, 40);
        scrollToItem(monthScrollRef, month, 40);
        scrollToItem(yearScrollRef, years.indexOf(year), 40);
      }, 100);
    }
  }, [showPicker, day, month, year, years]);

  const handleWheel = (e, type, setterFunc, items) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    const currentIndex = type === 'day' ? day - 1 : type === 'month' ? month : years.indexOf(year);
    const newIndex = Math.max(0, Math.min(items.length - 1, currentIndex + delta));
    
    if (type === 'day') setDay(newIndex + 1);
    if (type === 'month') setMonth(newIndex);
    if (type === 'year') setYear(items[newIndex]);
  };

  const formattedDate = value 
    ? `${value.getDate()} ${months[value.getMonth()]} ${value.getFullYear()}`
    : 'Select your birth date';

  return (
    <Box>
      <FormLabel
        component="legend"
        sx={{
          mb: 2,
          color: '#7a2fff',
          fontWeight: '700',
          fontFamily: "'Poppins', sans-serif",
          fontSize: '1rem',
          letterSpacing: '0.3px',
          display: 'block',
        }}
      >
        Birthday
      </FormLabel>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Button
          fullWidth
          onClick={() => setShowPicker(!showPicker)}
          sx={{
            p: 2,
            mb: 2,
            background: 'linear-gradient(135deg, rgba(122, 47, 255, 0.1), rgba(255, 95, 162, 0.1))',
            border: '2px solid rgba(122, 47, 255, 0.3)',
            borderRadius: 3,
            color: '#7a2fff',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: '600',
            fontSize: '1rem',
            textTransform: 'none',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'linear-gradient(135deg, rgba(122, 47, 255, 0.2), rgba(255, 95, 162, 0.2))',
              borderColor: '#7a2fff',
              transform: 'translateY(-2px)',
            },
          }}
        >
          📅 {formattedDate}
        </Button>

        {showPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <Box
              sx={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f4ff 100%)',
                border: '2px solid rgba(122, 47, 255, 0.3)',
                borderRadius: 3,
                p: 3,
                mb: 2,
              }}
            >
              <Typography
                sx={{
                  mb: 2,
                  color: '#7a2fff',
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: '700',
                  fontSize: '1rem',
                  textAlign: 'center',
                }}
              >
                Scroll to select date
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 2,
                  mb: 3,
                }}
              >
                {/* Day Picker */}
                <Box
                  ref={dayScrollRef}
                  onWheel={(e) => handleWheel(e, 'day', setDay, days)}
                  sx={{
                    height: '150px',
                    overflowY: 'scroll',
                    borderRadius: 2,
                    background: 'rgba(122, 47, 255, 0.05)',
                    p: 1,
                    '&::-webkit-scrollbar': {
                      width: '6px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: 'rgba(122, 47, 255, 0.1)',
                      borderRadius: '10px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: 'linear-gradient(135deg, #7a2fff, #ff5fa2)',
                      borderRadius: '10px',
                    },
                  }}
                >
                  {days.map((d) => (
                    <Box
                      key={d}
                      onClick={() => setDay(d)}
                      sx={{
                        p: 1,
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: day === d ? 'linear-gradient(135deg, #7a2fff, #ff5fa2)' : 'transparent',
                        color: day === d ? 'white' : '#7a2fff',
                        borderRadius: 2,
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: day === d ? '700' : '500',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          background: day === d ? 'linear-gradient(135deg, #7a2fff, #ff5fa2)' : 'rgba(122, 47, 255, 0.1)',
                        },
                      }}
                    >
                      {d}
                    </Box>
                  ))}
                </Box>

                {/* Month Picker */}
                <Box
                  ref={monthScrollRef}
                  onWheel={(e) => handleWheel(e, 'month', setMonth, months)}
                  sx={{
                    height: '150px',
                    overflowY: 'scroll',
                    borderRadius: 2,
                    background: 'rgba(122, 47, 255, 0.05)',
                    p: 1,
                    '&::-webkit-scrollbar': {
                      width: '6px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: 'rgba(122, 47, 255, 0.1)',
                      borderRadius: '10px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: 'linear-gradient(135deg, #7a2fff, #ff5fa2)',
                      borderRadius: '10px',
                    },
                  }}
                >
                  {months.map((m, idx) => (
                    <Box
                      key={idx}
                      onClick={() => setMonth(idx)}
                      sx={{
                        p: 1,
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: month === idx ? 'linear-gradient(135deg, #7a2fff, #ff5fa2)' : 'transparent',
                        color: month === idx ? 'white' : '#7a2fff',
                        borderRadius: 2,
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: month === idx ? '700' : '500',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          background: month === idx ? 'linear-gradient(135deg, #7a2fff, #ff5fa2)' : 'rgba(122, 47, 255, 0.1)',
                        },
                      }}
                    >
                      {m.slice(0, 3)}
                    </Box>
                  ))}
                </Box>

                {/* Year Picker */}
                <Box
                  ref={yearScrollRef}
                  onWheel={(e) => handleWheel(e, 'year', setYear, years)}
                  sx={{
                    height: '150px',
                    overflowY: 'scroll',
                    borderRadius: 2,
                    background: 'rgba(122, 47, 255, 0.05)',
                    p: 1,
                    '&::-webkit-scrollbar': {
                      width: '6px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: 'rgba(122, 47, 255, 0.1)',
                      borderRadius: '10px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: 'linear-gradient(135deg, #7a2fff, #ff5fa2)',
                      borderRadius: '10px',
                    },
                  }}
                >
                  {years.map((y) => (
                    <Box
                      key={y}
                      onClick={() => setYear(y)}
                      sx={{
                        p: 1,
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: year === y ? 'linear-gradient(135deg, #7a2fff, #ff5fa2)' : 'transparent',
                        color: year === y ? 'white' : '#7a2fff',
                        borderRadius: 2,
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: year === y ? '700' : '500',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          background: year === y ? 'linear-gradient(135deg, #7a2fff, #ff5fa2)' : 'rgba(122, 47, 255, 0.1)',
                        },
                      }}
                    >
                      {y}
                    </Box>
                  ))}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setShowPicker(false)}
                  sx={{
                    borderRadius: 2,
                    color: '#7a2fff',
                    borderColor: '#7a2fff',
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: '600',
                  }}
                >
                  Cancel
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleDateSelect}
                  sx={{
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #7a2fff, #ff5fa2)',
                    color: 'white',
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: '600',
                  }}
                >
                  Confirm
                </Button>
              </Box>
            </Box>
          </motion.div>
        )}
      </motion.div>
    </Box>
  );
};
