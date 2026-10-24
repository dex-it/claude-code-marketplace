// libcalc: расчёт тарифов подрядчика. Экспортируются C++-символы.
#include <string>
namespace tariff {
class Calculator {
public:
    double surcharge(int zone, const std::string &kind) const;
    static int version();
};
double Calculator::surcharge(int zone, const std::string &kind) const { return zone * 1.5 + (kind == "express" ? 4.0 : 0.0); }
int Calculator::version() { return 7; }
}
extern "C" int calc_api_level() { return 3; }
