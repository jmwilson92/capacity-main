/* Shared top navigation for Production Suite */
window.SuiteNav = {
  items: [
    { href: "CapacityTracker.html#dashboard", label: "Work Centers", match: ["CapacityTracker"] },
    { href: "CapacityTracker.html#planning", label: "Planning", match: ["CapacityTracker"] },
    { href: "WorkOrders.html", label: "Work Orders", match: ["WorkOrders"] },
    { href: "WipBoard.html", label: "WIP Board", match: ["WipBoard"] },
    { href: "WorkInstructions.html", label: "Work Instructions", match: ["WorkInstructions"] },
    { href: "Analytics.html", label: "Analytics", match: ["Analytics", "DowntimeLogger"] },
    { href: "Settings.html", label: "Settings", match: ["Settings", "SkillsMatrix"] }
  ],
  currentFile: function () {
    const path = (location.pathname || "").split("/").pop() || "";
    return path.replace(/\.html$/i, "") || "index";
  },
  html: function (activeLabel) {
    const file = this.currentFile();
    return this.items.map(function (item) {
      const on = activeLabel
        ? item.label === activeLabel
        : (item.match || []).some(function (m) { return file.indexOf(m) === 0 || file === m; });
      return '<a class="tab' + (on ? " is-on" : "") + '" href="' + item.href + '">' + item.label + "</a>";
    }).join("");
  }
};
