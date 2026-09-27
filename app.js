const selectedServices = new Set();
const dialog = document.querySelector(".brief-dialog");
const briefItems = document.querySelector("#brief-items");
const notes = document.querySelector("#project-notes");
const feedback = document.querySelector("#copy-feedback");
const delivery = window.inquiryDelivery;
let toastTimeout;
let returnFocus;
let inquiryText = "";

function showStep(index, moveFocus = true) {
  if (delivery.isSending() && index !== 2) return;
  ["cart-step", "checkout-step", "inquiry-step"].forEach((id, position) => {
    document.getElementById(id).hidden = index !== position;
  });
  document.querySelector("#brief-heading").textContent = [
    "Your cart",
    "The checkout",
    delivery.wasSent() ? "Inquiry submitted" : "Ready to say hello",
  ][index];
  document.querySelectorAll(".checkout-steps li").forEach((step, position) => {
    step.classList.toggle("current", index === position);
    if (position === index) step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
  });
  if (moveFocus) document.querySelector("#brief-heading").focus();
  dialog.scrollTop = 0;
}

function openCart(trigger, step = 0) {
  returnFocus = trigger;
  showStep(delivery.isSending() || delivery.wasSent() ? 2 : step, false);
  dialog.showModal();
  document.body.classList.add("dialog-open");
}

function announce(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2800);
}

function renderBrief() {
  const count = document.querySelector(".bag-count");
  count.textContent = selectedServices.size;
  count.setAttribute(
    "aria-label",
    `${selectedServices.size} selected services`,
  );
  document.querySelector("#brief-empty").hidden = selectedServices.size > 0;
  briefItems.replaceChildren();
  for (const service of selectedServices) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = service;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${service} from your cart`);
    remove.addEventListener("click", () => {
      const index = [...briefItems.children].indexOf(item);
      selectedServices.delete(service);
      renderBrief();
      const remaining = briefItems.querySelectorAll("button");
      (
        remaining[Math.min(index, remaining.length - 1)] ||
        document.querySelector("#checkout-button")
      ).focus();
    });
    item.append(name, remove);
    briefItems.append(item);
  }
  document.querySelectorAll(".add-button").forEach((button) => {
    const selected = selectedServices.has(button.dataset.service);
    button.classList.toggle("selected", selected);
    button.textContent = selected ? "✓" : "+";
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute(
      "aria-label",
      `${selected ? "Remove" : "Add"} ${button.dataset.service} ${selected ? "from" : "to"} your cart`,
    );
  });
  feedback.textContent = "";
}

document.querySelectorAll(".add-button").forEach((button) => {
  button.addEventListener("click", () => {
    const service = button.dataset.service;
    if (selectedServices.has(service)) {
      selectedServices.delete(service);
      announce(`${service} removed from your cart`);
    } else {
      selectedServices.add(service);
      announce(`${service} added to your cart`);
    }
    renderBrief();
  });
});

document
  .querySelector(".brief-toggle")
  .addEventListener("click", (event) => openCart(event.currentTarget));
document
  .querySelector("#start-inquiry")
  .addEventListener("click", (event) => openCart(event.currentTarget, 1));
document.querySelector("#add-developer").addEventListener("click", (event) => {
  document
    .querySelectorAll(".add-button")
    .forEach((button) => selectedServices.add(button.dataset.service));
  renderBrief();
  openCart(event.currentTarget);
});
document
  .querySelector(".close-brief")
  .addEventListener("click", () => dialog.close());
document
  .querySelector(".continue-shopping")
  .addEventListener("click", () => dialog.close());
document
  .querySelector("#checkout-button")
  .addEventListener("click", () => showStep(1));
document
  .querySelector(".back-to-cart")
  .addEventListener("click", () => showStep(0));
document
  .querySelector(".back-to-checkout")
  .addEventListener("click", () => showStep(1));
dialog.addEventListener("click", (event) => {
  const rect = dialog.getBoundingClientRect();
  if (
    event.target === dialog &&
    (event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom)
  )
    dialog.close();
});
dialog.addEventListener("close", () => {
  document.body.classList.remove("dialog-open");
  returnFocus?.focus();
});

document.querySelector("#checkout-step").addEventListener("submit", (event) => {
  event.preventDefault();
  if (delivery.isSending()) return;
  const services = [...selectedServices];
  const description = notes.value.trim();
  const name = document.querySelector("#client-name");
  if (!name.value.trim() || !description) {
    const field = !name.value.trim() ? name : notes;
    field.setCustomValidity("Please add a few words here.");
    field.reportValidity();
    return;
  }
  const company = document.querySelector("#client-company").value.trim();
  const email = document.querySelector("#client-email").value.trim();
  const timing = document.querySelector("#project-timing").value;
  inquiryText = [
    "Hi Sebastian,",
    `I’m ${name.value.trim()}${company ? ` from ${company}` : ""}. I’d like to discuss a project.`,
    `Expertise: ${services.length ? services.join(", ") : "Let’s work out what fits"}`,
    `Project:\n${description}`,
    `Preferred start: ${timing}`,
    `Reply to: ${email}`,
    "Let’s talk about availability, scope and next steps.",
    name.value.trim(),
  ].join("\n\n");
  document.querySelector("#inquiry-preview").textContent = inquiryText;
  feedback.textContent = "";
  showStep(2);
  delivery.prepare({
    name: name.value.trim(),
    email,
    company,
    message: inquiryText,
    subject: `Project inquiry${company ? ` — ${company}` : ""}`,
  });
});

document.querySelector("#new-inquiry").addEventListener("click", () => {
  delivery.reset();
  document.querySelector("#checkout-step").reset();
  selectedServices.clear();
  inquiryText = "";
  renderBrief();
  showStep(1);
});

document
  .querySelectorAll("#checkout-step input, #checkout-step textarea")
  .forEach((field) => {
    field.addEventListener("input", () => field.setCustomValidity(""));
  });

document.querySelector("#copy-brief").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(inquiryText);
    feedback.textContent =
      "Copied! Paste your inquiry into a LinkedIn message.";
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(document.querySelector("#inquiry-preview"));
    selection.removeAllRanges();
    selection.addRange(range);
    feedback.textContent =
      "Your browser blocked clipboard access. The inquiry is selected above; copy it manually.";
  }
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    document.querySelectorAll(".filter").forEach((option) => {
      option.classList.toggle("active", option === button);
      option.setAttribute("aria-pressed", String(option === button));
    });
    let visibleCount = 0;
    document.querySelectorAll(".product-card").forEach((card) => {
      card.hidden = filter !== "all" && filter !== card.dataset.category;
      if (!card.hidden) visibleCount++;
    });
    document.querySelector("#catalog-count").textContent =
      `${visibleCount} thoughtfully selected ${visibleCount === 1 ? "skill" : "skills"}`;
  });
});

if (
  "IntersectionObserver" in window &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 },
  );
  document.querySelectorAll(".reveal").forEach((element) => {
    element.classList.add("pre-reveal");
    observer.observe(element);
  });
}
document.querySelector("#year").textContent = new Date().getFullYear();
renderBrief();
