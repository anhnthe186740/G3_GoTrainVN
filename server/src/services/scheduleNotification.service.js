import { prisma } from "../config/database.js";
import { sendEmail } from "./email.service.js";
import {
  getScheduleDelayEmailTemplate,
  getScheduleCancelledEmailTemplate,
} from "../utils/emailTemplates.js";

/**
 * Gửi email thông báo thay đổi lịch trình (trễ giờ hoặc hủy chuyến) cho tất cả khách hàng đã đặt vé thành công.
 * @param {string} scheduleId - ID lịch trình
 * @param {"DELAYED" | "CANCELLED"} type - Loại sự kiện thay đổi
 * @param {object} details - Chi tiết (delayMinutes, originalDepartureTime, newDepartureTime, notes)
 */
export async function notifyScheduleChange(scheduleId, type, details) {
  try {
    // Tìm tất cả các booking có trạng thái CONFIRMED hoặc PENDING của lịch trình này
    const bookings = await prisma.booking.findMany({
      where: {
        scheduleId,
        status: { in: ["CONFIRMED", "PENDING"] },
      },
      include: {
        user: {
          select: { email: true, fullName: true },
        },
        schedule: {
          include: {
            train: { select: { trainCode: true, trainName: true } },
            route: {
              include: {
                startStation: { select: { stationName: true } },
                endStation: { select: { stationName: true } },
              },
            },
          },
        },
        fromStation: { select: { stationName: true } },
        toStation: { select: { stationName: true } },
        passengers: {
          select: { fullName: true, email: true },
        },
      },
    });

    if (bookings.length === 0) {
      console.log(
        `[Notification] Không có đơn đặt vé nào cho scheduleId ${scheduleId} cần thông báo.`,
      );
      return;
    }

    console.log(
      `[Notification] Tìm thấy ${bookings.length} đơn đặt vé bị ảnh hưởng. Bắt đầu gửi email...`,
    );

    for (const booking of bookings) {
      // Ưu tiên gửi tới confirmationEmail, sau đó là email của user tài khoản, và cuối cùng là email hành khách
      const email =
        booking.confirmationEmail ||
        booking.user?.email ||
        booking.passengers.find((p) => p.email)?.email;

      if (!email) {
        console.warn(
          `[Notification] Không tìm thấy email nhận cho Booking ID ${booking.id}`,
        );
        continue;
      }

      let subject = "";
      let html = "";

      if (type === "DELAYED") {
        subject = `[GoTrain VN] Thông báo thay đổi lịch chạy chuyến tàu ${booking.schedule.train.trainCode}`;
        html = getScheduleDelayEmailTemplate(
          booking,
          details.delayMinutes,
          details.originalDepartureTime,
          details.newDepartureTime,
          details.notes,
        );
      } else if (type === "CANCELLED") {
        subject = `[GoTrain VN] Hủy chuyến tàu khẩn cấp ${booking.schedule.train.trainCode}`;
        html = getScheduleCancelledEmailTemplate(booking, details.notes);
      }

      // Gửi email bất đồng bộ không chặn luồng chính
      sendEmail({ to: email, subject, html })
        .then(() => {
          console.log(
            `[Notification] Đã gửi email thông báo thành công tới: ${email}`,
          );
        })
        .catch((err) => {
          console.error(`[Notification] Lỗi khi gửi email tới ${email}:`, err);
        });
    }
  } catch (error) {
    console.error(
      `[Notification] Gặp lỗi trong notifyScheduleChange cho scheduleId ${scheduleId}:`,
      error,
    );
  }
}
