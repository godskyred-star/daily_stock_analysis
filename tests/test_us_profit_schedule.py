# -*- coding: utf-8 -*-
"""Tests for local US profit-monitor scheduling helpers."""

import unittest
from unittest.mock import MagicMock

from src.scheduler import Scheduler, unique_immediate_jobs
from src.us_profit_monitor import parse_hhmm_times


class ParseScheduleTimesTestCase(unittest.TestCase):
    def test_default_beijing_oriented_times(self):
        self.assertEqual(parse_hhmm_times(""), ["08:00", "21:00"])
        self.assertEqual(parse_hhmm_times(None), ["08:00", "21:00"])

    def test_normalizes_and_deduplicates(self):
        self.assertEqual(parse_hhmm_times("8:00, 21:00, 08:00"), ["08:00", "21:00"])

    def test_invalid_tokens_fall_back(self):
        self.assertEqual(parse_hhmm_times("25:00,abc"), ["08:00", "21:00"])

    def test_keeps_custom_valid_times(self):
        self.assertEqual(parse_hhmm_times("09:30,22:00"), ["09:30", "22:00"])


class SchedulerJobsTestCase(unittest.TestCase):
    def setUp(self):
        self.scheduler = Scheduler()
        self.scheduler.schedule.clear()

    def tearDown(self):
        self.scheduler.schedule.clear()

    def test_add_daily_task_registers_two_local_slots(self):
        task = MagicMock()
        self.scheduler.add_daily_task(task, "08:00", name="us-profit-monitor")
        self.scheduler.add_daily_task(task, "21:00", name="us-profit-monitor")
        jobs = self.scheduler.schedule.get_jobs()
        self.assertEqual(len(jobs), 2)
        at_times = sorted(job.at_time.strftime("%H:%M") for job in jobs)
        self.assertEqual(at_times, ["08:00", "21:00"])

    def test_unique_immediate_jobs_runs_each_callback_once(self):
        def task_a():
            return None

        def task_b():
            return None

        jobs = [
            ("08:00", task_a, "us-profit-monitor"),
            ("21:00", task_a, "us-profit-monitor"),
            ("18:00", task_b, "full-analysis"),
        ]
        unique = unique_immediate_jobs(jobs)
        self.assertEqual(len(unique), 2)
        self.assertEqual([name for _, name in unique], ["us-profit-monitor", "full-analysis"])


if __name__ == "__main__":
    unittest.main()
