import { prisma } from "../config/database.js";
import { sendEmail } from "./email.service.js";
import {
  getScheduleDelayEmailTemplate,
  getScheduleCancelledEmailTemplate,
  getCheckInReminderEmailTemplate,
} from "../utils/emailTemplates.js";

/**
 * Gửi email thông báo thay đổi lịch trình (trễ giờ hoặc hủy chuyến) cho tất cả khách hàng đã đặt vé thành công.
 * @param {string} scheduleId - ID lịch trình
 * @param {"DELAYED" | "CANCELLED"} type - Loại sự kiện thay đổi
 * @param {object} details - Chi tiết (delayMinutes, originalDepartureTime, newDepartureTime, notes)
 */
export async function notifyScheduleChange(
  scheduleIdOrBookings,
  type,
  details,
) {
  if (type !== "DELAYED" && type !== "CANCELLED") {
    console.error(`[Notification] Loại thông báo không hợp lệ: ${type}`);
    return;
  }
  try {
    let bookings = [];
    if (Array.isArray(scheduleIdOrBookings)) {
      bookings = scheduleIdOrBookings;
    } else {
      // Tìm tất cả các booking có trạng thái CONFIRMED hoặc PENDING của lịch trình này
      bookings = await prisma.booking.findMany({
        where: {
          scheduleId: scheduleIdOrBookings,
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
    }

    if (bookings.length === 0) {
      console.log(`[Notification] Không có đơn đặt vé nào cần thông báo.`);
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
          console.error(
            `[Notification] Lỗi khi gửi email tới ${email}:`,
            err.message || err,
          );
        });

      // Tránh vi phạm rate limit khi gửi mail hàng loạt
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  } catch (error) {
    console.error(
      `[Notification] Gặp lỗi trong notifyScheduleChange cho:`,
      scheduleIdOrBookings,
      error,
    );
  }
}

/**
 * Tự động tìm kiếm các hành khách chưa check-in và khởi hành trong vòng 30 phút tới để gửi email nhắc nhở.
 */
export async function checkAndSendCheckInReminders() {
  const now = new Date();
  const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);

  try {
    // 1. Quét tìm hành khách thỏa mãn các điều kiện
    const passengersToRemind = await prisma.passenger.findMany({
      where: {
        boardingAt: null,
        checkInReminderSent: false,
        booking: {
          status: "CONFIRMED",
          schedule: {
            departureTime: {
              gt: now,
              lte: thirtyMinutesLater,
            },
          },
        },
      },
      include: {
        booking: {
          include: {
            fromStation: true,
            toStation: true,
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
            user: {
              select: { email: true, fullName: true },
            },
          },
        },
      },
    });

    if (passengersToRemind.length === 0) {
      return;
    }

    console.log(
      `[CheckInReminder] Phát hiện ${passengersToRemind.length} hành khách chưa check-in sắp khởi hành. Bắt đầu gửi email...`,
    );

    for (const passenger of passengersToRemind) {
      // Tìm email nhận tin
      const email =
        passenger.email ||
        passenger.booking?.confirmationEmail ||
        passenger.booking?.user?.email;

      if (!email) {
        console.warn(
          `[CheckInReminder] Không tìm thấy email hợp lệ cho hành khách ID ${passenger.id}`,
        );
        continue;
      }

      const booking = passenger.booking;
      const schedule = booking?.schedule;

      if (!schedule) {
        console.warn(
          `[CheckInReminder] Không tìm thấy thông tin lịch trình cho hành khách ID ${passenger.id}`,
        );
        continue;
      }

      const subject = `[GoTrain VN] Nhắc nhở check-in lên tàu - Chuyến ${schedule.train.trainCode}`;
      const html = getCheckInReminderEmailTemplate(
        booking,
        passenger,
        schedule,
      );

      // Gửi email bất đồng bộ
      sendEmail({ to: email, subject, html })
        .then(async () => {
          console.log(
            `[CheckInReminder] Đã gửi email nhắc nhở check-in thành công tới: ${email}`,
          );
          // Cập nhật cờ checkInReminderSent thành true để tránh gửi lại
          await prisma.passenger.update({
            where: { id: passenger.id },
            data: { checkInReminderSent: true },
          });
        })
        .catch((err) => {
          console.error(
            `[CheckInReminder] Lỗi khi gửi email tới ${email}:`,
            err.message || err,
          );
        });

      // Bù khoảng giãn cách nhỏ để tránh bị quá tải rate limit gửi email
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  } catch (error) {
    console.error(
      `[CheckInReminder] Lỗi trong tác vụ quét nhắc nhở check-in:`,
      error,
    );
  }
}
