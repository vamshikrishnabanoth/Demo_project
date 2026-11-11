import random
from locust import HttpUser, task, between


class QuizPlatformUser(HttpUser):
    """Simulates a teacher using the quiz platform."""
    # Wait between 1 and 3 seconds between tasks
    wait_time = between(1, 3)

    def on_start(self):
        """
        Called once when a simulated user starts.
        Attempts login with a random teacher account.
        """
        credentials_list = [
            {"email": "teacher1@kmit.in", "password": "KMIT@1234"},
            {"email": "teacher2@kmit.in", "password": "KMIT@1234"},
            {"email": "teacher3@kmit.in", "password": "KMIT@1234"},
            {"email": "teacher4@kmit.in", "password": "KMIT@1234"},
            {"email": "teacher5@kmit.in", "password": "KMIT@1234"},
            {"email": "admin@kmit.in",    "password": "KMIT@1234"},
        ]

        self.credentials = random.choice(credentials_list)
        self.token = None
        self._do_login()

    def _do_login(self):
        """Logs in and stores the JWT token for subsequent requests."""
        payload = {
            "email":    self.credentials["email"],
            "password": self.credentials["password"],
        }
        with self.client.post(
            "/api/auth/login",
            json=payload,
            headers={"Content-Type": "application/json"},
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                self.token = response.json().get("token")
                self.client.headers.update({"x-auth-token": self.token})
                response.success()
            else:
                response.failure(
                    f"Login failed for {self.credentials['email']}: "
                    f"{response.status_code} – {response.text[:200]}"
                )

    @task(3)
    def view_me(self):
        """Simulates visiting the profile/me endpoint."""
        if self.token:
            self.client.get("/api/auth/me")

    @task(5)
    def get_live_quizzes(self):
        """Simulates fetching live/available quizzes."""
        if self.token:
            self.client.get("/api/quiz/live")

    @task(4)
    def get_my_quizzes(self):
        """Simulates a teacher fetching their own created quizzes."""
        if self.token:
            self.client.get("/api/quiz/my-quizzes")

    @task(2)
    def get_stats(self):
        """Simulates a teacher checking performance statistics."""
        if self.token:
            self.client.get("/api/quiz/stats")

    @task(1)
    def check_analytics(self):
        """Simulates visiting the analytics dashboard."""
        if self.token:
            self.client.get("/api/analytics/teacher")
