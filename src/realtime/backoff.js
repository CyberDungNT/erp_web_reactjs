/**
 * Thời gian chờ trước khi kết nối lại – CÓ NGẪU NHIÊN (jitter).
 * Server restart / mất mạng: nếu 100k client cùng thử lại sau đúng 0s, 2s, 5s... thì server và DB bị dội cùng lúc
 * ("thundering herd"). Rải ngẫu nhiên trong khoảng [base/2, base*1.5] để các client vào lại lần lượt.
 */
const STEPS = [1500, 4000, 10000, 20000, 45000];

/** attempt: lần thử thứ mấy (0 = lần đầu). Trả về ms. */
export function backoffDelay(attempt) {
  const base = STEPS[Math.min(attempt, STEPS.length - 1)];
  return Math.round(base / 2 + Math.random() * base);
}
