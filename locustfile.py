import random
from locust import HttpUser, task, between

class QuizPlatformUser(HttpUser):
    # Wait between 1 and 3 seconds between tasks to simulate realistic user thinking time
    wait_time = between(1, 3)
    
    def on_start(self):
        """
        Executed when a simulated user starts.
        We will attempt to log in using one of the pre-seeded teacher accounts.
        """
        # List of potential teacher accounts to log in with
        credentials_list = [
            {"email": "teacher1@kmit.in", "password": "KMIT@1234"},
            {"email": "teacher2@kmit.in", "password": "KMIT@1234"},
            {"email": "teacher3@kmit.in", "password": "KMIT@1234"},
            {"email": "teacher4@kmit.in", "password": "KMIT@1234"},
            {"email": "teacher5@kmit.in", "password": "KMIT@1234"},
            {"email": "admin@kmit.in", "password": "KMIT@1234"},
        ]
        
        # Pick one randomly
        self.credentials = random.choice(credentials_list)
        self.token = None
        self.login()

    def login(self):
        """
        Logs in the user and saves the JWT token for subsequent requests.
        """
        headers = {"Content-Type": "application/json"}
        payload = {
            "email": self.credentials["email"],
            "password": self.credentials["password"]
        }
        
        # Disable online-status restriction check if applicable, or simulate clean login
        with self.client.post("/api/auth/login", json=payload, headers=headers, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                # Add Authorization header for all future requests of this user session
                self.client.headers.update({"x-auth-token": self.token})
                response.success()
            else:
                # If login fails, log it and try a fallback password (e.g. teacher1@kk if reset_passwords was run)
                fallback_password = f"{self.credentials['email'].split('@')[0]}@kk"
                payload["password"] = fallback_password
                
                with self.client.post("/api/auth/login", json=payload, headers=headers, catch_response=True) as fb_response:
                    if fb_response.status_code == 200:
                        data = fb_response.json()
                        self.token = data.get("token")
                        self.client.headers.update({"x-auth-token": self.token})
                        fb_response.success()
                    else:
                        fb_response.failure(f"Login failed for {self.credentials['email']} with both default and fallback passwords.")

    @task(3)
    def view_me(self):
        """
        Simulates visiting the profile/me endpoint to fetch user info.
        """
        if self.token:
            self.client.get("/api/auth/me")

    @task(5)
    def get_live_quizzes(self):
        """
        Simulates fetching live/available quizzes.
        """
        if self.token:
            self.client.get("/api/quiz/live")

    @task(4)
    def get_my_quizzes(self):
        """
        Simulates a teacher fetching their own created quizzes.
        """
        if self.token:
            self.client.get("/api/quiz/my-quizzes")

    @task(2)
    def get_stats(self):
        """
        Simulates a teacher checking performance statistics.
        """
        if self.token:
            self.client.get("/api/quiz/stats")

    @task(1)
    def check_analytics(self):
        """
        Simulates visiting the analytics dashboard.
        """
        if self.token:
            self.client.get("/api/analytics/teacher")
