// UTILS FOR EMAIL TEMPLATES (HTML RESPONSIVE)

const formatPrice = (amount) => {
  return amount != null
    ? `${Math.round(amount).toLocaleString("vi-VN")}đ`
    : "0đ";
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  // Using UTC+7 representation
  return d.toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
};

/**
 * Template 1: Welcome Email
 */
export function getWelcomeEmailTemplate(fullName, email) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="color: #00629d; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">GoTrain VN</h1>
        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;">Hệ thống vé tàu điện tử thông minh</p>
      </div>
      
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 20px; font-weight: 700;">Chào mừng bạn, ${fullName}!</h2>
        <p style="margin: 0; line-height: 1.6; font-size: 15px; color: #475569;">
          Cảm ơn bạn đã đăng ký tài khoản tại <strong>GoTrain VN</strong>. Tài khoản của bạn đã được khởi tạo thành công và sẵn sàng sử dụng.
        </p>
      </div>

      <div style="background-color: #f8fafc; border-radius: 12px; padding: 15px 20px; margin-bottom: 25px; border: 1px solid #f1f5f9;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Thông tin tài khoản</h3>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Họ và tên:</strong> ${fullName}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Số dư ví mặc định:</strong> 0đ</p>
      </div>

      <p style="line-height: 1.6; font-size: 15px; margin-bottom: 25px; color: #475569;">
        Với tài khoản GoTrain VN, bạn có thể dễ dàng tìm kiếm chuyến đi, giữ ghế ngồi mong muốn, thanh toán nhanh chóng qua Ví điện tử hoặc tài khoản ngân hàng và quản lý toàn bộ vé điện tử của mình.
      </p>

      <div style="text-align: center; margin-bottom: 25px;">
        <a href="${process.env.CLIENT_URL || "http://localhost:5173"}/login" style="background-color: #00629d; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 10px; font-weight: 600; display: inline-block; transition: background-color 0.2s;">Đăng nhập ngay</a>
      </div>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
      
      <div style="text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <p style="margin: 0 0 5px 0;">Email này được gửi tự động từ hệ thống GoTrain VN.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} GoTrain VN. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  `;
}

/**
 * Template 2: Booking Pending Payment (Chờ thanh toán)
 */
export function getBookingPendingEmailTemplate(booking) {
  const schedule = booking.schedule;
  const trainName = schedule?.train?.trainName || "Tàu hỏa";
  const startStation = booking.fromStation?.stationName || "Ga đi";
  const endStation = booking.toStation?.stationName || "Ga đến";
  const departureTime = formatDate(schedule?.departureTime);

  const passengerRows = (booking.passengers || [])
    .map(
      (p, i) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 12px 10px; font-size: 14px;">${i + 1}</td>
      <td style="padding: 12px 10px; font-size: 14px; font-weight: 600;">${p.fullName}</td>
      <td style="padding: 12px 10px; font-size: 14px;">${p.passengerType === "CHILD" ? "Trẻ em" : p.passengerType === "STUDENT" ? "Sinh viên" : p.passengerType === "SENIOR" ? "Người cao tuổi" : "Người lớn"}</td>
      <td style="padding: 12px 10px; font-size: 14px; text-align: center;">Toa ${p.carriageNumber || "—"}</td>
      <td style="padding: 12px 10px; font-size: 14px; text-align: center; font-weight: 600; color: #00629d;">Ghe ${p.seat?.seatNumber || "—"}</td>
    </tr>
  `,
    )
    .join("");

  const paySection = booking.payosCheckoutUrl
    ? `
    <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 25px;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 700; color: #b45309;">Hướng dẫn thanh toán</h3>
      <p style="margin: 0 0 15px 0; font-size: 14px; color: #78350f; line-height: 1.5;">
        Vui lòng hoàn tất thanh toán trước khi phiên giữ ghế hết hạn vào lúc <strong>${formatDate(booking.expiresAt)}</strong> để không bị hủy vé tự động.
      </p>
      <a href="${booking.payosCheckoutUrl}" style="background-color: #d97706; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">Thanh toán ngay qua PayOS</a>
    </div>
  `
    : "";

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #ffeeb2; color: #854d0e; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Chờ thanh toán</span>
        <h1 style="color: #00629d; margin: 10px 0 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">GoTrain VN</h1>
        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Mã đặt chỗ: <strong style="color: #00629d; font-size: 16px;">${booking.bookingCode}</strong></p>
      </div>
      
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 18px; font-weight: 700;">Đặt chỗ thành công!</h2>
        <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #475569;">
          Hệ thống đã ghi nhận yêu cầu đặt chỗ của bạn. Thông tin hành trình chi tiết như sau:
        </p>
      </div>

      <!-- Journey Info -->
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 15px 20px; margin-bottom: 25px; border: 1px solid #f1f5f9;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Thông tin hành trình</h3>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Chuyến tàu:</strong> ${trainName}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Ga đi:</strong> ${startStation}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Ga đến:</strong> ${endStation}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Khởi hành:</strong> ${departureTime}</p>
      </div>

      <!-- Passengers Table -->
      <div style="margin-bottom: 25px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Hành khách & Ghế ngồi</h3>
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
              <th style="padding: 10px; font-size: 13px; color: #475569;">STT</th>
              <th style="padding: 10px; font-size: 13px; color: #475569;">Họ và Tên</th>
              <th style="padding: 10px; font-size: 13px; color: #475569;">Đối tượng</th>
              <th style="padding: 10px; font-size: 13px; color: #475569; text-align: center;">Toa</th>
              <th style="padding: 10px; font-size: 13px; color: #475569; text-align: center;">Ghế</th>
            </tr>
          </thead>
          <tbody>
            ${passengerRows}
          </tbody>
        </table>
      </div>

      <!-- Payment total -->
      <div style="border-top: 1px solid #f1f5f9; padding-top: 15px; margin-bottom: 25px; text-align: right;">
        <p style="margin: 0; font-size: 14px; color: #64748b;">Tổng tiền thanh toán:</p>
        <p style="margin: 5px 0 0 0; font-size: 22px; font-weight: 800; color: #e11d48;">${formatPrice(booking.totalAmount)}</p>
      </div>

      <!-- Payment Section -->
      ${paySection}

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
      
      <div style="text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <p style="margin: 0 0 5px 0;">Cảm ơn bạn đã lựa chọn dịch vụ của chúng tôi.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} GoTrain VN. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  `;
}

/**
 * Template 3: Payment Success / E-Ticket (Thanh toán thành công & Vé điện tử)
 */
export function getPaymentSuccessEmailTemplate(booking) {
  const schedule = booking.schedule;
  const trainName = schedule?.train?.trainName || "Tàu hỏa";
  const startStation = booking.fromStation?.stationName || "Ga đi";
  const endStation = booking.toStation?.stationName || "Ga đến";
  const departureTime = formatDate(schedule?.departureTime);

  const ticketCards = (booking.passengers || [])
    .map(
      (p, i) => `
    <div style="background-color: #fafafa; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 18px; margin-bottom: 15px; position: relative;">
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 10px;">
        <span style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">Vé điện tử #${i + 1}</span>
        <span style="font-size: 13px; font-weight: 800; color: #0f172a;">Mã vé: ${p.ticketCode || "GT-TICKET"}</span>
      </div>
      <div style="font-size: 14px; line-height: 1.6;">
        <p style="margin: 4px 0;"><strong>Hành khách:</strong> ${p.fullName}</p>
        <p style="margin: 4px 0;"><strong>Đối tượng:</strong> ${p.passengerType === "CHILD" ? "Trẻ em" : p.passengerType === "STUDENT" ? "Sinh viên" : p.passengerType === "SENIOR" ? "Người cao tuổi" : "Người lớn"}</p>
        <p style="margin: 4px 0;"><strong>Giấy tờ (CCCD/HC):</strong> ${p.nationalId || "N/A"}</p>
        <div style="display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 5px 12px; border-radius: 6px; font-weight: 700; margin-top: 8px; font-size: 13px;">
          Toa ${p.carriageNumber || "—"} | Ghế số ${p.seat?.seatNumber || "—"}
        </div>
      </div>
    </div>
  `,
    )
    .join("");

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #cbd5e1; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #d1fae5; color: #065f46; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Thanh toán thành công</span>
        <h1 style="color: #00629d; margin: 10px 0 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">GoTrain VN</h1>
        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Mã đặt chỗ: <strong style="color: #00629d; font-size: 16px;">${booking.bookingCode}</strong></p>
      </div>
      
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0 0 5px 0; font-size: 18px; font-weight: 700;">Vé điện tử của bạn đã được xuất!</h2>
        <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #475569;">
          Cảm ơn bạn đã hoàn tất thanh toán. Vui lòng xuất trình mã vé điện tử bên dưới cho nhân viên soát vé khi lên tàu.
        </p>
      </div>

      <!-- Journey Info -->
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 15px 20px; margin-bottom: 25px; border: 1px solid #f1f5f9;">
        <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Thông tin chuyến đi</h3>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Đoàn tàu:</strong> ${trainName}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Hành trình:</strong> ${startStation} &rarr; ${endStation}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Thời gian khởi hành:</strong> ${departureTime}</p>
      </div>

      <!-- Tickets list -->
      <div style="margin-bottom: 25px;">
        <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Thông tin vé hành khách</h3>
        ${ticketCards}
      </div>

      <!-- Billing Summary -->
      <div style="background-color: #fafafa; border-radius: 12px; padding: 15px 20px; margin-bottom: 25px; border: 1px solid #f1f5f9; font-size: 14px;">
        <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Thông tin hóa đơn</h3>
        <p style="margin: 5px 0; display: flex; justify-content: space-between;"><span>Phương thức thanh toán:</span> <strong>${booking.paymentMethod === "WALLET" ? "Ví điện tử GoTrain" : "Chuyển khoản QR ngân hàng"}</strong></p>
        <p style="margin: 5px 0; display: flex; justify-content: space-between;"><span>Tổng tiền đã trả:</span> <strong style="color: #065f46;">${formatPrice(booking.totalAmount)}</strong></p>
        <p style="margin: 5px 0; display: flex; justify-content: space-between;"><span>Thời gian thanh toán:</span> <span>${formatDate(booking.paidAt || new Date())}</span></p>
      </div>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
      
      <div style="text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <p style="margin: 0 0 5px 0;">Chúc quý khách có một hành trình an toàn và vui vẻ!</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} GoTrain VN. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  `;
}

/**
 * Template 4: Ticket Cancelled / Refund (Hủy vé thành công & Hoàn tiền)
 */
export function getCancelBookingEmailTemplate(
  booking,
  refundAmount,
  refundPercentage,
  refundMethod,
) {
  const schedule = booking.schedule;
  const trainName = schedule?.train?.trainName || "Tàu hỏa";
  const startStation = booking.fromStation?.stationName || "Ga đi";
  const endStation = booking.toStation?.stationName || "Ga đến";
  const departureTime = formatDate(schedule?.departureTime);

  const passengerNames = (booking.passengers || [])
    .map((p) => p.fullName)
    .join(", ");
  const methodLabel =
    refundMethod === "WALLET" ? "Hoàn vào Ví GoTrain VN" : "Liên hệ quầy vé ga";

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #fca5a5; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #fee2e2; color: #991b1b; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Hủy vé thành công</span>
        <h1 style="color: #00629d; margin: 10px 0 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">GoTrain VN</h1>
        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Mã đặt chỗ đã hủy: <strong style="color: #991b1b; font-size: 16px;">${booking.bookingCode}</strong></p>
      </div>
      
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 18px; font-weight: 700;">Xác nhận hủy vé & hoàn tiền</h2>
        <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #475569;">
          Yêu cầu hủy vé của quý khách đối với đơn hàng <strong>${booking.bookingCode}</strong> đã được thực hiện thành công. Vé này đã bị vô hiệu hóa.
        </p>
      </div>

      <!-- Cancelled Journey Info -->
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 15px 20px; margin-bottom: 25px; border: 1px solid #f1f5f9; font-size: 14px;">
        <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Hành trình đã hủy</h3>
        <p style="margin: 5px 0;"><strong>Đoàn tàu:</strong> ${trainName}</p>
        <p style="margin: 5px 0;"><strong>Hành trình:</strong> ${startStation} &rarr; ${endStation}</p>
        <p style="margin: 5px 0;"><strong>Thời gian khởi hành:</strong> ${departureTime}</p>
        <p style="margin: 5px 0;"><strong>Hành khách:</strong> ${passengerNames}</p>
      </div>

      <!-- Refund Details -->
      <div style="background-color: #fef2f2; border-radius: 12px; padding: 15px 20px; margin-bottom: 25px; border: 1px solid #fee2e2; font-size: 14px;">
        <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">Thông tin hoàn tiền</h3>
        <p style="margin: 5px 0; display: flex; justify-content: space-between;"><span>Giá trị đơn vé:</span> <strong>${formatPrice(booking.totalAmount)}</strong></p>
        <p style="margin: 5px 0; display: flex; justify-content: space-between;"><span>Tỷ lệ hoàn tiền:</span> <strong>${refundPercentage}%</strong></p>
        <p style="margin: 5px 0; display: flex; justify-content: space-between;"><span>Lệ phí hủy vé:</span> <strong>${formatPrice(booking.totalAmount - refundAmount)}</strong></p>
        <hr style="border: 0; border-top: 1px solid #fee2e2; margin: 10px 0;" />
        <p style="margin: 5px 0; display: flex; justify-content: space-between; font-size: 15px; font-weight: 700;"><span>Số tiền hoàn lại:</span> <span style="color: #b91c1c;">${formatPrice(refundAmount)}</span></p>
        <p style="margin: 5px 0; display: flex; justify-content: space-between;"><span>Hình thức hoàn tiền:</span> <strong>${methodLabel}</strong></p>
      </div>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
      
      <div style="text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <p style="margin: 0 0 5px 0;">Nếu quý khách có bất kỳ thắc mắc nào, vui lòng liên hệ CSKH GoTrain VN.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} GoTrain VN. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  `;
}
