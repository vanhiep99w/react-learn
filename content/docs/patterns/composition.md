---
title: "Composition"
description: "Ghép component qua children & slots thay vì kế thừa hay props lồng nhau — nền tảng của mọi pattern React"
---

# Composition

## Mục lục

- [Tổng quan](#tổng-quan)
- [1. Composition thay cho kế thừa](#1-composition-thay-cho-kế-thừa)
- [2. children — slot mặc định](#2-children--slot-mặc-định)
- [3. Nhiều slot bằng props](#3-nhiều-slot-bằng-props)
- [4. Composition giải bài toán prop drilling](#4-composition-giải-bài-toán-prop-drilling)
- [5. Composition là một tối ưu performance](#5-composition-là-một-tối-ưu-performance)
- [6. Khi nào chia component](#6-khi-nào-chia-component)
- [Tài liệu tham khảo](#tài-liệu-tham-khảo)

---

## Tổng quan

**Composition** (ghép nối) là triết lý cốt lõi của React: xây UI phức tạp bằng cách **lồng các component đơn giản** vào nhau, truyền nội dung qua `children` và props, thay vì kế thừa class hay nhồi mọi thứ vào một component khổng lồ.

> [!IMPORTANT]
> Gần như mọi "pattern" nâng cao (compound components, render props, provider...) đều là biến thể của composition. Nắm chắc composition, các pattern sau chỉ là áp dụng có chủ đích.

---

## 1. Composition thay cho kế thừa

Trong OOP bạn hay nghĩ tới kế thừa (`class Admin extends User`). React **không** khuyến khích điều đó. Muốn tái dùng/biến thể, ta **ghép** component.

```tsx
// ❌ Tư duy kế thừa (không React-y)
// class SuccessButton extends Button { ... }

// ✅ Tư duy composition: Button tổng quát, các biến thể là cách DÙNG nó
function Button({ variant = 'default', children }: {
  variant?: 'default' | 'success' | 'danger';
  children: React.ReactNode;
}) {
  return <button className={`btn btn-${variant}`}>{children}</button>;
}

// Tạo biến thể bằng cách bọc, không kế thừa:
const SuccessButton = (props: { children: React.ReactNode }) => (
  <Button variant="success" {...props} />
);
```

---

## 2. children — slot mặc định

`children` là "lỗ trống" để nhét nội dung tùy ý vào component. Nó biến component thành cái hộp chứa.

```tsx
function Card({ children }: { children: React.ReactNode }) {
  return <div className="card">{children}</div>;
}

// Dùng:
<Card>
  <h2>Tiêu đề</h2>
  <p>Nội dung bất kỳ</p>
</Card>
```

`Card` không cần biết bên trong là gì — nó chỉ lo phần khung. Đây là **đảo ngược điều khiển (inversion of control)**: nơi dùng quyết định nội dung, component quyết định bố cục.

---

## 3. Nhiều slot bằng props

Khi cần nhiều "lỗ trống" ở các vị trí khác nhau, truyền JSX qua **props** (slot pattern):

```tsx
function PageLayout({ header, sidebar, children, footer }: {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="layout">
      <header>{header}</header>
      <div className="body">
        <aside>{sidebar}</aside>
        <main>{children}</main>
      </div>
      <footer>{footer}</footer>
    </div>
  );
}

// Dùng:
<PageLayout
  header={<NavBar />}
  sidebar={<Menu />}
  footer={<Copyright />}
>
  <Article />
</PageLayout>
```

> [!TIP]
> JSX là giá trị bình thường — truyền được qua bất kỳ prop nào, không chỉ `children`. Dùng tên prop có nghĩa (`header`, `icon`, `actions`) khi có nhiều slot.

---

## 4. Composition giải bài toán prop drilling

**Prop drilling** = truyền một prop qua nhiều tầng trung gian không dùng tới nó. Composition thường xóa bỏ nhu cầu đó: thay vì truyền *dữ liệu* xuống, ta truyền *JSX đã gắn sẵn dữ liệu* vào.

```tsx
// ❌ Drilling: user đi qua Page → Layout → Header → Avatar
<Page user={user} /> // Page truyền cho Layout, Layout truyền cho Header...

// ✅ Composition: gắn Avatar(user) ở ngoài, nhét vào qua slot
<Layout header={<Avatar user={user} />}>
  <Content />
</Layout>
// Layout & Header không cần biết tới "user" nữa
```

> [!NOTE]
> Composition không thay thế Context — nó **giảm** nhu cầu Context cho các trường hợp đơn giản. Context dành cho dữ liệu cần ở **rất nhiều nơi rải rác**; composition giải quyết drilling theo một nhánh dọc.

---

## 5. Composition là một tối ưu performance

Như đã nói ở [React.memo](/toi-uu-rerender/react-memo/): nội dung truyền qua `children` **không** render lại khi component bọc nó đổi state, vì element đó được tạo ở cấp trên.

```tsx
function ColorBox({ children }: { children: React.ReactNode }) {
  const [color, setColor] = useState('white');
  return (
    <div style={{ background: color }}>
      <button onClick={() => setColor('skyblue')}>Đổi màu</button>
      {children} {/* không render lại khi color đổi */}
    </div>
  );
}

export default function App() {
  return (
    <ColorBox>
      <ExpensiveTree /> {/* tạo 1 lần ở App; bấm "Đổi màu" không khiến nó render lại */}
    </ColorBox>
  );
}
```

```mermaid
graph TD
    App["App tạo &lt;ExpensiveTree/&gt; element 1 lần"] --> CB["ColorBox (state color)"]
    CB -->|"color đổi → ColorBox render"| Btn["nút render lại"]
    CB -.->|"children là element CŨ → KHÔNG render lại"| ET["ExpensiveTree giữ nguyên"]
```

> [!IMPORTANT]
> Đây là một trong những kỹ thuật tối ưu **rẻ và sạch** nhất: thay vì `memo`, hãy thử **đẩy phần nặng ra ngoài và nhận lại qua `children`**. Không cần so sánh props, không cần ổn định tham chiếu.

---

## 6. Khi nào chia component

<Accordions type="single">
  <Accordion title="Khi một phần UI lặp lại">
    Lặp 2-3 lần → tách thành component nhận props khác nhau.
  </Accordion>
  <Accordion title="Khi một component quá dài / nhiều việc">
    Một component nên có một trách nhiệm rõ ràng. &gt;200 dòng hay quản lý nhiều mảng state không liên quan = dấu hiệu cần tách.
  </Accordion>
  <Accordion title="Khi cần tối ưu re-render cục bộ">
    Tách phần đổi state thành component con để re-render chỉ giới hạn ở đó (colocation).
  </Accordion>
  <Accordion title="ĐỪNG chia quá sớm">
    Chia khi có nhu cầu thật. Tách quá nhỏ tạo 'lasagna code' — nhiều tầng mỏng khó lần theo.
  </Accordion>
</Accordions>

---

## Tài liệu tham khảo

- [React Docs — Passing JSX as children](https://react.dev/learn/passing-props-to-a-component#passing-jsx-as-children)
- [React.memo — phần children](/toi-uu-rerender/react-memo/)
- [Compound Components](/patterns/compound-components/)
