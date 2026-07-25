// UTILS FOR EMAIL TEMPLATES (HTML RESPONSIVE)

const formatPrice = (amount) => {
  return amount != null && !isNaN(amount)
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

  const passengers = booking.passengers || [];
  const seatedPassengers = passengers.filter(
    (p) =>
      p.seatRequired !== false &&
      p.passengerType !== "CHILD_UNDER_6" &&
      (p.seat || p.seatId),
  );
  const lapChildren = passengers.filter(
    (p) =>
      p.seatRequired === false ||
      p.passengerType === "CHILD_UNDER_6" ||
      (!p.seat && !p.seatId),
  );

  const displayList =
    seatedPassengers.length > 0 ? seatedPassengers : passengers;

  const passengerRows = displayList
    .map((p, i) => {
      const assignedLapChild = lapChildren[i] || null;
      const lapInfo = assignedLapChild
        ? `<br/><span style="font-size: 12px; color: #d97706; font-weight: 600;">+ Trẻ em ngồi cùng: ${assignedLapChild.fullName} (Miễn phí)</span>`
        : "";
      return `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 12px 10px; font-size: 14px;">${i + 1}</td>
      <td style="padding: 12px 10px; font-size: 14px; font-weight: 600;">${p.fullName}${lapInfo}</td>
      <td style="padding: 12px 10px; font-size: 14px;">${p.passengerType === "CHILD_UNDER_6" ? "Trẻ em dưới 6 tuổi" : p.passengerType === "CHILD" ? "Trẻ em" : p.passengerType === "STUDENT" ? "Sinh viên" : p.passengerType === "SENIOR" ? "Người cao tuổi" : "Người lớn"}</td>
      <td style="padding: 12px 10px; font-size: 14px; text-align: center;">Toa ${p.carriageNumber || "—"}</td>
      <td style="padding: 12px 10px; font-size: 14px; text-align: center; font-weight: 600; color: #00629d;">Ghe ${p.seat?.seatNumber || "—"}</td>
    </tr>
  `;
    })
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

  const passengers = booking.passengers || [];
  const seatedPassengers = passengers.filter(
    (p) =>
      p.seatRequired !== false &&
      p.passengerType !== "CHILD_UNDER_6" &&
      (p.seat || p.seatId),
  );
  const lapChildren = passengers.filter(
    (p) =>
      p.seatRequired === false ||
      p.passengerType === "CHILD_UNDER_6" ||
      (!p.seat && !p.seatId),
  );

  const displayTickets =
    seatedPassengers.length > 0 ? seatedPassengers : passengers;

  const ticketCards = displayTickets
    .map((p, i) => {
      const assignedLapChild = lapChildren[i] || null;
      const lapChildHtml = assignedLapChild
        ? `
        <div style="margin-top: 12px; padding: 10px 14px; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; font-size: 13px; color: #92400e;">
          <strong>👶 Trẻ em ngồi cùng ghế:</strong> ${assignedLapChild.fullName} (Dưới 6 tuổi — Miễn phí không chiếm ghế riêng)
        </div>
      `
        : "";

      return `
    <div style="background-color: #fafafa; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 18px; margin-bottom: 15px; position: relative;">
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 10px;">
        <span style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">Vé điện tử #${i + 1}</span>
        <span style="font-size: 13px; font-weight: 800; color: #0f172a;">Mã vé: ${p.ticketCode || "GT-TICKET"}</span>
      </div>
      <div style="font-size: 14px; line-height: 1.6;">
        <p style="margin: 4px 0;"><strong>Hành khách:</strong> ${p.fullName}</p>
        <p style="margin: 4px 0;"><strong>Đối tượng:</strong> ${p.passengerType === "CHILD_UNDER_6" ? "Trẻ em dưới 6 tuổi" : p.passengerType === "CHILD" ? "Trẻ em" : p.passengerType === "STUDENT" ? "Sinh viên" : p.passengerType === "SENIOR" ? "Người cao tuổi" : "Người lớn"}</p>
        <p style="margin: 4px 0;"><strong>Giấy tờ (CCCD/HC):</strong> ${p.nationalId || "N/A"}</p>
        <div style="display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 5px 12px; border-radius: 6px; font-weight: 700; margin-top: 8px; font-size: 13px;">
          Toa ${p.carriageNumber || "—"} | Ghế số ${p.seat?.seatNumber || "—"}
        </div>
        ${lapChildHtml}
        <div style="margin-top: 15px; text-align: center; border-top: 1px dashed #e2e8f0; padding-top: 12px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(p.ticketCode || "")}" alt="Mã QR soát vé" style="border: 1.5px solid #cbd5e1; padding: 6px; border-radius: 10px; background-color: #ffffff; width: 130px; height: 130px;" />
          <p style="margin: 6px 0 0 0; font-size: 11px; color: #64748b; font-weight: 600;">Quét mã này tại ga để soát vé lên tàu</p>
        </div>
      </div>
    </div>
  `;
    })
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
  const schedule = booking?.schedule;
  const trainName = schedule?.train?.trainName || "Tàu hỏa";
  const startStation = booking?.fromStation?.stationName || "Ga đi";
  const endStation = booking?.toStation?.stationName || "Ga đến";
  const departureTime = formatDate(schedule?.departureTime);

  const passengerNames = (booking?.passengers || [])
    .map((p) => p.fullName)
    .join(", ");
  const methodLabel =
    refundMethod === "WALLET" ? "Hoàn vào Ví GoTrain VN" : "Liên hệ quầy vé ga";

  const totalAmount = booking?.totalAmount || 0;
  const refundAmt = refundAmount || 0;
  const cancellationFee = Math.max(0, totalAmount - refundAmt);

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
        <p style="margin: 5px 0; display: flex; justify-content: space-between;"><span>Giá trị đơn vé:</span> <strong>${formatPrice(totalAmount)}</strong></p>
        <p style="margin: 5px 0; display: flex; justify-content: space-between;"><span>Tỷ lệ hoàn tiền:</span> <strong>${refundPercentage}%</strong></p>
        <p style="margin: 5px 0; display: flex; justify-content: space-between;"><span>Lệ phí hủy vé:</span> <strong>${formatPrice(cancellationFee)}</strong></p>
        <hr style="border: 0; border-top: 1px solid #fee2e2; margin: 10px 0;" />
        <p style="margin: 5px 0; display: flex; justify-content: space-between; font-size: 15px; font-weight: 700;"><span>Số tiền hoàn lại:</span> <span style="color: #b91c1c;">${formatPrice(refundAmt)}</span></p>
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

/**
 * Template 5: Train Delay Notification (Thông báo trễ chuyến)
 */
export function getScheduleDelayEmailTemplate(
  booking,
  delayMinutes,
  originalTime,
  newTime,
  notes,
) {
  const schedule = booking.schedule;
  const trainName = schedule?.train?.trainName || "Tàu hỏa";
  const trainCode = schedule?.train?.trainCode || "";
  const startStation = booking.fromStation?.stationName || "Ga đi";
  const endStation = booking.toStation?.stationName || "Ga đến";

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #fcd34d; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #fef3c7; color: #d97706; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Cập nhật lịch trình</span>
        <h1 style="color: #00629d; margin: 10px 0 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">GoTrain VN</h1>
        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Mã đặt chỗ: <strong style="color: #00629d; font-size: 16px;">${booking.bookingCode}</strong></p>
      </div>
      
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 18px; font-weight: 700;">Thông báo hoãn chuyến tàu</h2>
        <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #475569;">
          Xin chào quý khách. GoTrain VN xin thông báo hành trình chuyến tàu <strong>${trainCode}</strong> (${trainName}) của quý khách có sự thay đổi về thời gian khởi hành do sự cố kỹ thuật hoặc điều kiện vận hành.
        </p>
      </div>

      <!-- Delay Details -->
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #b45309; text-transform: uppercase;">Chi tiết thay đổi</h3>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Hành trình:</strong> ${startStation} &rarr; ${endStation}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Thời gian hoãn:</strong> <span style="color: #b91c1c; font-weight: bold;">+${delayMinutes} phút</span></p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Giờ khởi hành gốc:</strong> ${formatDate(originalTime)}</p>
        <p style="margin: 5px 0; font-size: 14px; color: #b45309;"><strong>Giờ khởi hành dự kiến mới:</strong> <strong>${formatDate(newTime)}</strong></p>
        ${notes ? `<p style="margin: 5px 0; font-size: 14px;"><strong>Lý do:</strong> ${notes}</p>` : ""}
      </div>

      <p style="line-height: 1.6; font-size: 14px; margin-bottom: 25px; color: #475569;">
        Chúng tôi vô cùng xin lỗi vì sự bất tiện này gây ra cho hành trình của quý khách. Quý khách vui lòng lưu ý thời gian mới để sắp xếp thời gian có mặt tại ga hợp lý.
      </p>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
      
      <div style="text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <p style="margin: 0 0 5px 0;">Email này được gửi tự động từ hệ thống GoTrain VN.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} GoTrain VN. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  `;
}

/**
 * Template 6: Train Cancellation Notification (Thông báo hủy chuyến do sự cố/bảo trì)
 */
export function getScheduleCancelledEmailTemplate(booking, notes) {
  const schedule = booking.schedule;
  const trainName = schedule?.train?.trainName || "Tàu hỏa";
  const trainCode = schedule?.train?.trainCode || "";
  const startStation = booking.fromStation?.stationName || "Ga đi";
  const endStation = booking.toStation?.stationName || "Ga đến";
  const departureTime = schedule?.departureTime;

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #fca5a5; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #fee2e2; color: #b91c1c; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Hủy chuyến tàu</span>
        <h1 style="color: #00629d; margin: 10px 0 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">GoTrain VN</h1>
        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Mã đặt chỗ bị hủy: <strong style="color: #b91c1c; font-size: 16px;">${booking.bookingCode}</strong></p>
      </div>
      
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 18px; font-weight: 700;">Thông báo hủy chuyến tàu khẩn cấp</h2>
        <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #475569;">
          Xin chào quý khách. GoTrain VN vô cùng thương tiếc thông báo chuyến tàu <strong>${trainCode}</strong> (${trainName}) dự kiến khởi hành lúc <strong>${formatDate(departureTime)}</strong> đã bị hủy vì lý do bảo trì đột xuất hoặc sự cố kỹ thuật trên tuyến đường.
        </p>
      </div>

      <!-- Cancel Details -->
      <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #991b1b; text-transform: uppercase;">Thông tin chuyến bị ảnh hưởng</h3>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Hành trình:</strong> ${startStation} &rarr; ${endStation}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Giờ xuất phát dự kiến:</strong> ${formatDate(departureTime)}</p>
        ${notes ? `<p style="margin: 5px 0; font-size: 14px; color: #991b1b;"><strong>Lý do hủy:</strong> ${notes}</p>` : ""}
      </div>

      <h3 style="color: #0f172a; font-size: 15px; font-weight: 700; margin: 0 0 10px 0;">Chính sách hỗ trợ hoàn trả</h3>
      <p style="line-height: 1.6; font-size: 14px; margin-bottom: 25px; color: #475569;">
        Đơn vé của quý khách đã tự động được chuyển sang trạng thái <strong>ĐÃ HỦY</strong>. Hệ thống của chúng tôi đang tiến hành thủ tục hoàn trả 100% tiền vé vào Ví điện tử của tài khoản đặt vé (hoặc quý khách có thể liên hệ trực tiếp quầy vé ga gần nhất để đổi hành trình mới miễn phí).
      </p>

      <p style="line-height: 1.6; font-size: 14px; margin-bottom: 25px; color: #475569; font-weight: bold;">
        Chúng tôi vô cùng xin lỗi vì sự bất tiện này và rất mong nhận được sự thông cảm từ quý khách.
      </p>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
      
      <div style="text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <p style="margin: 0 0 5px 0;">Email này được gửi tự động từ hệ thống GoTrain VN.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} GoTrain VN. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  `;
}

/**
 * Template 7: Refund Approved Notification (Thông báo chấp nhận hoàn tiền)
 */
export function getRefundApprovedEmailTemplate(
  booking,
  refundAmount,
  method = "WALLET",
) {
  const trainName = booking.schedule?.train?.trainName || "Tàu hỏa";
  const trainCode = booking.schedule?.train?.trainCode || "";

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #bbf7d0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #dcfce7; color: #15803d; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Hoàn tiền thành công</span>
        <h1 style="color: #00629d; margin: 10px 0 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">GoTrain VN</h1>
        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Mã đặt chỗ: <strong style="color: #00629d; font-size: 16px;">${booking.bookingCode}</strong></p>
      </div>
      
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 18px; font-weight: 700;">Yêu cầu hủy vé & hoàn tiền đã được chấp nhận</h2>
        <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #475569;">
          Xin chào quý khách. Yêu cầu hủy vé cho chuyến tàu <strong>${trainCode} (${trainName})</strong> của quý khách đã được bộ phận chăm sóc khách hàng phê duyệt.
        </p>
      </div>

      <div style="background-color: #f0fdf4; border: 1px solid #dcfce7; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #15803d; text-transform: uppercase;">Chi tiết hoàn tiền</h3>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Số tiền hoàn trả:</strong> <span style="color: #15803d; font-size: 18px; font-weight: 800;">${formatPrice(refundAmount)}</span></p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Phương thức hoàn:</strong> ${method === "WALLET" ? "Ví điện tử GoTrain" : "Chuyển khoản ngân hàng"}</p>
        <p style="margin: 5px 0; font-size: 14px;"><strong>Thời gian duyệt:</strong> ${formatDate(new Date())}</p>
      </div>

      <p style="line-height: 1.6; font-size: 14px; margin-bottom: 25px; color: #475569;">
        Nếu hoàn qua Ví điện tử GoTrain, số dư đã được cộng trực tiếp vào ví của bạn. Nếu hoàn qua ngân hàng, giao dịch xử lý từ 1-3 ngày làm việc.
      </p>
    </div>
  `;
}

/**
 * Template 7: Wallet Deposit Success (Nạp tiền vào ví thành công)
 */
export function getWalletDepositEmailTemplate(fullName, amount, balance, txId) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #cbd5e1; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #d1fae5; color: #065f46; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Giao dịch thành công</span>
        <h1 style="color: #00629d; margin: 10px 0 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">GoTrain VN</h1>
        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Thông báo biến động số dư</p>
      </div>
      
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 18px; font-weight: 700;">Nạp tiền vào ví thành công!</h2>
        <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #475569;">
          Xin chào <strong>${fullName}</strong>, ví điện tử GoTrain của bạn đã được ghi nhận một giao dịch nạp tiền thành công. Chi tiết giao dịch như sau:
        </p>
      </div>

      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 15px 20px; margin-bottom: 25px; font-size: 14px;">
        <p style="margin: 5px 0; display: flex; justify-content: space-between;"><span>Số tiền nạp:</span> <strong style="color: #16a34a; font-size: 16px;">+${formatPrice(amount)}</strong></p>
        <p style="margin: 5px 0; display: flex; justify-content: space-between;"><span>Số dư ví hiện tại:</span> <strong>${formatPrice(balance)}</strong></p>
        <p style="margin: 5px 0; display: flex; justify-content: space-between; color: #64748b;"><span>Mã giao dịch:</span> <span>${txId || "N/A"}</span></p>
        <p style="margin: 5px 0; display: flex; justify-content: space-between; color: #64748b;"><span>Thời gian:</span> <span>${formatDate(new Date())}</span></p>
      </div>

      <p style="line-height: 1.6; font-size: 14px; color: #475569;">
        Bạn có thể sử dụng số dư ví này để thực hiện đặt mua vé trực tuyến nhanh chóng mà không cần qua cổng ngân hàng.
      </p>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
      
      <div style="text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <p style="margin: 0 0 5px 0;">Cảm ơn bạn đã sử dụng dịch vụ của GoTrain VN.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} GoTrain VN. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  `;
}

/**
 * Template 8: Check-In Success (Boarding confirmation)
 */
export function getCheckInEmailTemplate(
  fullName,
  ticketCode,
  trainCode,
  seatNumber,
  carriageNumber,
) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #dbeafe; color: #1d4ed8; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Check-in thành công</span>
        <h1 style="color: #00629d; margin: 10px 0 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">GoTrain VN</h1>
        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Chúc bạn có một hành trình vui vẻ</p>
      </div>
      
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 18px; font-weight: 700;">Lên tàu thành công!</h2>
        <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #475569;">
          Kính chào hành khách <strong>${fullName}</strong>, hệ thống đã ghi nhận bạn hoàn tất soát vé và lên tàu thành công.
        </p>
      </div>

      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 15px 20px; margin-bottom: 25px; font-size: 14px;">
        <p style="margin: 5px 0;"><strong>Mã vé:</strong> ${ticketCode}</p>
        <p style="margin: 5px 0;"><strong>Chuyến tàu:</strong> ${trainCode}</p>
        <p style="margin: 5px 0;"><strong>Toa tàu:</strong> Toa số ${carriageNumber}</p>
        <p style="margin: 5px 0;"><strong>Vị trí ghế:</strong> Ghế ${seatNumber}</p>
        <p style="margin: 5px 0; color: #64748b;"><strong>Thời gian check-in:</strong> ${formatDate(new Date())}</p>
      </div>

      <p style="line-height: 1.6; font-size: 14px; color: #475569;">
        Vui lòng tìm đúng toa và số ghế của mình. Hành lý cá nhân vui lòng sắp xếp gọn gàng ở khoang để đồ trên cao. Chúc quý khách có một chuyến đi an toàn và thoải mái cùng GoTrain VN!
      </p>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
      
      <div style="text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <p style="margin: 0 0 5px 0;">Email này được gửi tự động từ hệ thống GoTrain VN.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} GoTrain VN. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  `;
}

/**
 * Template 8: Refund Rejected Notification (Thông báo từ chối hoàn tiền)
 */
export function getRefundRejectedEmailTemplate(booking, reason) {
  const trainName = booking.schedule?.train?.trainName || "Tàu hỏa";
  const trainCode = booking.schedule?.train?.trainCode || "";

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #fed7aa; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #ffedd5; color: #c2410c; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Yêu cầu bị từ chối</span>
        <h1 style="color: #00629d; margin: 10px 0 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">GoTrain VN</h1>
        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Mã đặt chỗ: <strong style="color: #00629d; font-size: 16px;">${booking.bookingCode}</strong></p>
      </div>
      
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 18px; font-weight: 700;">Thông báo kết quả xử lý yêu cầu hủy vé</h2>
        <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #475569;">
          Xin chào quý khách. Yêu cầu hủy vé cho chuyến tàu <strong>${trainCode} (${trainName})</strong> của quý khách đã bị từ chối vì chưa đủ điều kiện theo quy định của đường sắt.
        </p>
      </div>

      <div style="background-color: #fff7ed; border: 1px solid #ffedd5; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #c2410c; text-transform: uppercase;">Lý do từ chối</h3>
        <p style="margin: 5px 0; font-size: 14px; color: #9a3412;">${reason || "Yêu cầu không thỏa mãn điều kiện quy định đổi/trả vé trước giờ khởi hành."}</p>
      </div>

      <p style="line-height: 1.6; font-size: 14px; margin-bottom: 25px; color: #475569;">
        Quý khách vui lòng liên hệ tổng đài hỗ trợ hoặc quầy vé tại ga nếu cần thêm thông tin giải đáp.
      </p>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
      
      <div style="text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <p style="margin: 0 0 5px 0;">Email này được gửi tự động từ hệ thống GoTrain VN.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} GoTrain VN. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  `;
}

/**
 * Template 9: Account Locked (Khóa tài khoản)
 */
export function getAccountLockedEmailTemplate(fullName, reason) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #fecaca; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #fee2e2; color: #991b1b; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Bảo mật tài khoản</span>
        <h1 style="color: #00629d; margin: 10px 0 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">GoTrain VN</h1>
      </div>
      
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #b91c1c; margin: 0 0 10px 0; font-size: 18px; font-weight: 700;">Tài khoản của bạn đã bị khóa tạm thời</h2>
        <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #475569;">
          Xin chào <strong>${fullName}</strong>, chúng tôi rất tiếc phải thông báo rằng tài khoản GoTrain VN của bạn đã bị tạm khóa bởi quản trị viên hệ thống.
        </p>
      </div>

      <div style="background-color: #fff5f5; border: 1px solid #feb2b2; border-radius: 12px; padding: 15px 20px; margin-bottom: 25px; font-size: 14px;">
        <p style="margin: 0; font-weight: bold; color: #c53030;">Lý do khóa tài khoản:</p>
        <p style="margin: 5px 0 0 0; color: #4a5568; font-style: italic;">"${reason || "Không xác định hoặc vi phạm điều khoản dịch vụ"}"</p>
      </div>

      <p style="line-height: 1.6; font-size: 14px; color: #475569;">
        Nếu bạn cho rằng đây là một sự nhầm lẫn hoặc muốn thực hiện yêu cầu mở khóa tài khoản, vui lòng liên hệ ngay với bộ phận chăm sóc khách hàng của GoTrain VN để được hỗ trợ giải quyết.
      </p>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
      
      <div style="text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <p style="margin: 0 0 5px 0;">Mọi thắc mắc vui lòng gửi về hòm thư hỗ trợ chính thức.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} GoTrain VN. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  `;
}

/**
 * Template 10: Account Unlocked (Mở khóa tài khoản)
 */
export function getAccountUnlockedEmailTemplate(fullName) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #cbd5e1; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #d1fae5; color: #065f46; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Tài khoản kích hoạt</span>
        <h1 style="color: #00629d; margin: 10px 0 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">GoTrain VN</h1>
      </div>
      
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #15803d; margin: 0 0 10px 0; font-size: 18px; font-weight: 700;">Tài khoản đã được mở khóa!</h2>
        <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #475569;">
          Xin chào <strong>${fullName}</strong>, chúng tôi vui mừng thông báo tài khoản GoTrain VN của bạn đã được mở khóa thành công.
        </p>
      </div>

      <p style="line-height: 1.6; font-size: 14px; color: #475569;">
        Hiện tại bạn đã có thể đăng nhập lại vào hệ thống, quản lý ví và thực hiện đặt vé tàu như bình thường.
      </p>

      <div style="text-align: center; margin: 20px 0;">
        <a href="${process.env.CLIENT_URL || "http://localhost:5173"}/login" style="background-color: #00629d; color: #ffffff; padding: 10px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Đăng nhập ngay</a>
      </div>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
      
      <div style="text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <p style="margin: 0 0 5px 0;">Chúc quý khách có trải nghiệm tốt cùng GoTrain VN.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} GoTrain VN. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  `;
}

/**
 * Template 11: Profile Updated Alert (Cảnh báo hồ sơ thay đổi)
 */
export function getProfileUpdatedEmailTemplate(fullName, updateTime) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #fef3c7; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #fef3c7; color: #d97706; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Cảnh báo bảo mật</span>
        <h1 style="color: #00629d; margin: 10px 0 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">GoTrain VN</h1>
      </div>
      
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #d97706; margin: 0 0 10px 0; font-size: 18px; font-weight: 700;">Hồ sơ cá nhân vừa được thay đổi</h2>
        <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #475569;">
          Xin chào <strong>${fullName}</strong>, hệ thống ghi nhận thông tin tài khoản của bạn (Họ tên, SĐT, CCCD...) vừa được cập nhật vào lúc <strong>${updateTime}</strong>.
        </p>
      </div>

      <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 15px; margin-bottom: 25px; font-size: 13.5px; color: #78350f; line-height: 1.5;">
        <strong>Lưu ý bảo mật:</strong> Nếu bạn chính là người thực hiện cập nhật này, bạn có thể bỏ qua email cảnh báo này. Tuy nhiên, nếu bạn không thực hiện đổi thông tin, vui lòng đổi mật khẩu ngay lập tức hoặc liên hệ hỗ trợ để khóa tài khoản khẩn cấp tránh bị mất vé.
      </div>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
      
      <div style="text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <p style="margin: 0 0 5px 0;">Hệ thống bảo mật GoTrain VN.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} GoTrain VN. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  `;
}

/**
 * Template 12: Support Form Confirmation (Xác nhận khách hàng gửi hỗ trợ)
 */
export function getContactFormConfirmationEmailTemplate(
  name,
  subject,
  message,
) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #cbd5e1; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #e0f2fe; color: #0369a1; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Đã tiếp nhận yêu cầu</span>
        <h1 style="color: #00629d; margin: 10px 0 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">GoTrain VN</h1>
      </div>
      
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 18px; font-weight: 700;">Chúng tôi đã nhận được tin nhắn từ bạn!</h2>
        <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #475569;">
          Xin chào <strong>${name}</strong>, cảm ơn bạn đã gửi liên hệ tới bộ phận chăm sóc khách hàng của GoTrain VN. Chúng tôi sẽ phản hồi lại bạn qua địa chỉ email này trong vòng 24 giờ.
        </p>
      </div>

      <div style="background-color: #f8fafc; border-radius: 12px; padding: 15px 20px; margin-bottom: 25px; font-size: 14px; border: 1px solid #f1f5f9;">
        <p style="margin: 5px 0;"><strong>Chủ đề:</strong> ${subject || "Hỗ trợ dịch vụ"}</p>
        <p style="margin: 5px 0;"><strong>Nội dung đã gửi:</strong></p>
        <p style="margin: 5px 0 0 0; color: #475569; font-style: italic; background-color: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">"${message}"</p>
      </div>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
      
      <div style="text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <p style="margin: 0 0 5px 0;">Cảm ơn bạn đã kiên nhẫn chờ đợi.</p>
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} GoTrain VN. Mọi quyền được bảo lưu.</p>
      </div>
    </div>
  `;
}

/**
 * Template 13: Support Admin Notification (Thông báo có yêu cầu hỗ trợ mới cho Admin)
 */
export function getAdminContactFormNotificationEmailTemplate(
  name,
  email,
  subject,
  message,
) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="background-color: #f1f5f9; color: #475569; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Yêu cầu hỗ trợ mới</span>
        <h1 style="color: #00629d; margin: 10px 0 0 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">GoTrain VN</h1>
      </div>
      
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 18px; font-weight: 700;">Hệ thống nhận được liên hệ mới</h2>
        <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #475569;">
          Kính gửi Admin, một khách hàng vừa gửi biểu mẫu liên hệ/yêu cầu trợ giúp từ website:
        </p>
      </div>

      <div style="background-color: #f8fafc; border-radius: 12px; padding: 15px 20px; margin-bottom: 25px; font-size: 14px; border: 1px solid #f1f5f9;">
        <p style="margin: 5px 0;"><strong>Họ tên khách:</strong> ${name}</p>
        <p style="margin: 5px 0;"><strong>Email khách:</strong> <a href="mailto:${email}" style="color: #00629d; text-decoration: none;">${email}</a></p>
        <p style="margin: 5px 0;"><strong>Chủ đề:</strong> ${subject}</p>
        <p style="margin: 5px 0;"><strong>Nội dung tin nhắn:</strong></p>
        <p style="margin: 5px 0 0 0; color: #334155; background-color: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">"${message}"</p>
      </div>

      <p style="line-height: 1.6; font-size: 14px; color: #475569;">
        Vui lòng xem xét nội dung và phản hồi lại cho khách hàng sớm nhất qua email của họ.
      </p>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
      
      <div style="text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} GoTrain VN Administration.</p>
      </div>
    </div>
  `;
}
