'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, TextField, Typography, Paper } from '@mui/material';

export default function SignUpPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
      const token = localStorage.getItem('access_token');
      if (token) {
        router.replace('/landing');
      } else {
        setIsCheckingAuth(false);
      }
    }, [router]);

    if (isCheckingAuth) {
      return null;
    } 
  

   const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/signup/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Signup successful:", data);
        setSuccess("Account created successfully! Redirecting to login...");
        setTimeout(() => {
          router.push('/logIn');
        }, 2000);
      } else {
        const errData = await response.json();
        setError(errData.error || "Signup failed. Please try again.");
      }
    } catch (err) {
      setError("Something went wrong. Please try again later.");
      console.error("Signup error:", err);
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      sx={{ backgroundColor: "#f5f5f5" }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: 400,
          borderRadius: 3,
        }}
      >
        <Typography variant="h5" align="center" sx={{ mb:2 }}>
          <b>Sign Up</b>
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            fullWidth
            label="Username"
            variant="outlined"
            margin="normal"
            color="secondary" //  can change to diff color when focused
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <TextField
            fullWidth
            label="Email"
            variant="outlined"
            margin="normal"
            color="secondary" //  can change to diff color when focused
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <TextField
            fullWidth
            label="Password"
            type="password"
            variant="outlined"
            margin="normal"
            color="secondary" //  can change to diff color when focused
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}

          {success && (
            <Typography color="success" variant="body2" sx={{ mt: 1, color: '#4CAF50' }}>
              {success}
            </Typography>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 2, mb: 1, backgroundColor: "#161b4cff" }}
          >
            Sign Up
          </Button>
        </Box>

        <Typography align="center" variant="body2" sx={{ mt: 2 }}>
          Already have an account?{" "}
          <a href="/logIn" style={{ color: "#161b4cff", textDecoration: "underline" }}>
            Login here
          </a>
        </Typography>
      </Paper>
    </Box>
  );
}

