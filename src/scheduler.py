# -*- coding: utf-8 -*-
"""
===================================
定时调度模块
===================================

职责：
1. 支持每日定时执行股票分析
2. 支持定时执行大盘复盘
3. 支持同一进程挂多个本地巡检时间（如美股止盈 08:00 / 21:00）
4. 优雅处理信号，确保可靠退出

依赖：
- schedule: 轻量级定时任务库
"""

import logging
import signal
import time
import threading
from datetime import datetime
from typing import Callable, Iterable, List, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)

ScheduledJob = Tuple[str, Callable[[], None], str]


class GracefulShutdown:
    """
    优雅退出处理器
    
    捕获 SIGTERM/SIGINT 信号，确保任务完成后再退出
    """
    
    def __init__(self):
        self.shutdown_requested = False
        self._lock = threading.Lock()
        
        # 注册信号处理器
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """信号处理函数"""
        with self._lock:
            if not self.shutdown_requested:
                logger.info(f"收到退出信号 ({signum})，等待当前任务完成...")
                self.shutdown_requested = True
    
    @property
    def should_shutdown(self) -> bool:
        """检查是否应该退出"""
        with self._lock:
            return self.shutdown_requested


class Scheduler:
    """
    定时任务调度器
    
    基于 schedule 库实现，支持：
    - 每日定时执行
    - 同一调度器挂多个 HH:MM 任务
    - 启动时立即执行
    - 优雅退出
    """
    
    def __init__(self, schedule_time: str = "18:00"):
        """
        初始化调度器
        
        Args:
            schedule_time: 默认每日执行时间，格式 "HH:MM"（兼容旧调用）
        """
        try:
            import schedule
            self.schedule = schedule
        except ImportError:
            logger.error("schedule 库未安装，请执行: pip install schedule")
            raise ImportError("请安装 schedule 库: pip install schedule")
        
        self.schedule_time = schedule_time
        self.shutdown_handler = GracefulShutdown()
        self._task_callback: Optional[Callable] = None
        self._running = False
        
    def add_daily_task(self, task: Callable, schedule_time: str, name: str = "task") -> None:
        """Register a named daily job at HH:MM without running it immediately."""
        def job():
            self._safe_run_named_task(task, name)

        job.__name__ = f"job_{name}_{schedule_time.replace(':', '')}"
        self.schedule.every().day.at(schedule_time).do(job)
        logger.info("已设置本地每日定时任务 [%s]，执行时间: %s", name, schedule_time)

    def set_daily_task(self, task: Callable, run_immediately: bool = True):
        """
        设置每日定时任务
        
        Args:
            task: 要执行的任务函数（无参数）
            run_immediately: 是否在设置后立即执行一次
        """
        self._task_callback = task
        
        # 设置每日定时任务
        self.schedule.every().day.at(self.schedule_time).do(self._safe_run_task)
        logger.info(f"已设置每日定时任务，执行时间: {self.schedule_time}")
        
        if run_immediately:
            logger.info("立即执行一次任务...")
            self._safe_run_task()

    def _safe_run_named_task(self, task: Callable, name: str) -> None:
        """Run one named job with exception isolation."""
        try:
            logger.info("=" * 50)
            logger.info(
                "本地定时任务 [%s] 开始执行 - %s",
                name,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            )
            logger.info("=" * 50)
            task()
            logger.info(
                "本地定时任务 [%s] 执行完成 - %s",
                name,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            )
        except Exception as e:
            logger.exception("本地定时任务 [%s] 执行失败: %s", name, e)
    
    def _safe_run_task(self):
        """安全执行任务（带异常捕获）"""
        if self._task_callback is None:
            return
        self._safe_run_named_task(self._task_callback, "task")
    
    def run(self):
        """
        运行调度器主循环
        
        阻塞运行，直到收到退出信号
        """
        self._running = True
        logger.info("调度器开始运行（本地进程常驻）...")
        logger.info(f"下次执行时间: {self._get_next_run_time()}")
        
        while self._running and not self.shutdown_handler.should_shutdown:
            self.schedule.run_pending()
            time.sleep(30)  # 每30秒检查一次
            
            # 每小时打印一次心跳
            if datetime.now().minute == 0 and datetime.now().second < 30:
                logger.info(f"调度器运行中... 下次执行: {self._get_next_run_time()}")
        
        logger.info("调度器已停止")
    
    def _get_next_run_time(self) -> str:
        """获取下次执行时间"""
        jobs = self.schedule.get_jobs()
        if jobs:
            next_run = min(job.next_run for job in jobs)
            return next_run.strftime('%Y-%m-%d %H:%M:%S')
        return "未设置"
    
    def stop(self):
        """停止调度器"""
        self._running = False


def unique_immediate_jobs(jobs: Sequence[ScheduledJob]) -> List[Tuple[Callable[[], None], str]]:
    """Keep the first occurrence of each (task, name) pair for startup runs."""
    seen = set()
    unique: List[Tuple[Callable[[], None], str]] = []
    for _when, task, name in jobs:
        key = (id(task), name)
        if key in seen:
            continue
        seen.add(key)
        unique.append((task, name))
    return unique


def run_with_jobs(
    jobs: Iterable[ScheduledJob],
    run_immediately: bool = True,
):
    """
    Register multiple local daily jobs and block in the scheduler loop.

    Args:
        jobs: iterable of (HH:MM, callback, name)
        run_immediately: run each unique callback once at startup
    """
    job_list = list(jobs)
    if not job_list:
        raise ValueError("run_with_jobs requires at least one job")

    scheduler = Scheduler(schedule_time=job_list[0][0])
    for when, task, name in job_list:
        scheduler.add_daily_task(task, when, name=name)

    if run_immediately:
        logger.info("启动时立即执行一次本地任务...")
        for task, name in unique_immediate_jobs(job_list):
            scheduler._safe_run_named_task(task, name)

    scheduler.run()


def run_with_schedule(
    task: Callable,
    schedule_time: str = "18:00",
    run_immediately: bool = True
):
    """
    便捷函数：使用定时调度运行任务
    
    Args:
        task: 要执行的任务函数
        schedule_time: 每日执行时间
        run_immediately: 是否立即执行一次
    """
    run_with_jobs(
        [(schedule_time, task, "task")],
        run_immediately=run_immediately,
    )


if __name__ == "__main__":
    # 测试定时调度
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s',
    )
    
    def test_task():
        print(f"任务执行中... {datetime.now()}")
        time.sleep(2)
        print("任务完成!")
    
    print("启动测试调度器（按 Ctrl+C 退出）")
    run_with_schedule(test_task, schedule_time="23:59", run_immediately=True)
