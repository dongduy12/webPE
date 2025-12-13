using Microsoft.AspNetCore.Mvc;

namespace PESystem.Areas.Bonepile.Controllers
{
    public class BonepileSummaryController : Controller
    {
        [Area("Bonepile")]
        public IActionResult Index()
        {
            return View();
        }
    }
}
